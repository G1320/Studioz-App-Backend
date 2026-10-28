import { Request } from 'express';
import mongoose, { Document } from 'mongoose';
import type { RemoteProject } from '../../types/remoteProject.js';
import { RemoteProjectModel } from '../../models/remoteProjectModel.js';
import { ProjectAccessRequestModel } from '../../models/projectAccessRequestModel.js';
import { UserModel } from '../../models/userModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { createAndEmitNotification } from '../../utils/notificationUtils.js';
import {
  assertProjectAccess,
  findActiveCollaborator,
  getAuthUserId,
  getProjectParticipantIds
} from '../../services/projectAccessService.js';
import {
  assertCollaboratorCapacity,
  assertGrantWithinAccess,
  parseProjectGrant,
  serializeGrant,
  upsertCollaborator
} from '../../services/projectGrantService.js';
import { emitProjectStatusUpdate } from '../../webSockets/socket.js';

interface AuthRequest extends Request {
  decodedJwt?: { _id?: string; userId?: string };
}

/** After a denial, the same person can ask again once this has passed. */
export const ACCESS_REQUEST_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
const ACCESS_REQUEST_MESSAGE_MAX_LENGTH = 500;
const DEFAULT_APPROVAL_ROLE = 'reviewer';

type ProjectDoc = RemoteProject & Document;

async function loadProject(projectId: string): Promise<ProjectDoc> {
  if (!mongoose.Types.ObjectId.isValid(projectId)) throw new ExpressError('Project not found', 404);
  const project = (await RemoteProjectModel.findById(projectId)) as ProjectDoc | null;
  if (!project) throw new ExpressError('Project not found', 404);
  return project;
}

function isParticipant(project: ProjectDoc, userId: string): boolean {
  return (
    String(project.customerId) === userId ||
    String(project.vendorId) === userId ||
    Boolean(findActiveCollaborator(project, userId))
  );
}

function serializeOwnRequest(request: InstanceType<typeof ProjectAccessRequestModel> | null) {
  if (!request) return null;
  const retryAt =
    request.status === 'denied' && request.decidedAt
      ? new Date(request.decidedAt.getTime() + ACCESS_REQUEST_RETRY_AFTER_MS)
      : null;
  return {
    _id: request._id,
    status: request.status,
    createdAt: request.createdAt,
    decidedAt: request.decidedAt ?? null,
    canRequestAgainAt: retryAt
  };
}

/**
 * The signed-in user's own standing on a project they opened by link.
 * Reveals nothing about the project beyond whether it exists.
 * GET /api/remote-projects/:projectId/access-requests/me
 */
const getMyAccessRequest = handleRequest(async (req: Request) => {
  const userId = getAuthUserId(req as AuthRequest);
  const project = await loadProject(req.params.projectId);
  if (isParticipant(project, userId)) return { hasAccess: true, request: null };

  const latest = await ProjectAccessRequestModel.findOne({ projectId: project._id, userId }).sort({ createdAt: -1 });
  return { hasAccess: false, request: serializeOwnRequest(latest) };
});

/**
 * POST /api/remote-projects/:projectId/access-requests  { message? }
 */
const requestAccess = handleRequest(async (req: Request) => {
  const userId = getAuthUserId(req as AuthRequest);
  const project = await loadProject(req.params.projectId);
  if (isParticipant(project, userId)) {
    throw new ExpressError('You already have access to this project', 400);
  }

  const rawMessage = (req.body as { message?: unknown } | undefined)?.message;
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  if (message.length > ACCESS_REQUEST_MESSAGE_MAX_LENGTH) {
    throw new ExpressError(`Message can be at most ${ACCESS_REQUEST_MESSAGE_MAX_LENGTH} characters`, 400);
  }

  const latest = await ProjectAccessRequestModel.findOne({ projectId: project._id, userId }).sort({ createdAt: -1 });
  if (latest?.status === 'pending') return { request: serializeOwnRequest(latest) };
  if (
    latest?.status === 'denied' &&
    latest.decidedAt &&
    Date.now() - latest.decidedAt.getTime() < ACCESS_REQUEST_RETRY_AFTER_MS
  ) {
    throw new ExpressError('Your request was declined. You can ask again tomorrow.', 429);
  }

  let request;
  try {
    request = await ProjectAccessRequestModel.create({
      projectId: project._id,
      userId,
      message: message || undefined
    });
  } catch (error) {
    // Lost a race with a concurrent request from the same user: return the open one.
    if ((error as { code?: number }).code === 11000) {
      const open = await ProjectAccessRequestModel.findOne({ projectId: project._id, userId, status: 'pending' });
      return { request: serializeOwnRequest(open) };
    }
    throw error;
  }

  const requester = await UserModel.findById(userId).select('name email');
  const requesterName = requester?.name || requester?.email || 'Someone';
  const projectId = String(project._id);
  const owners = [String(project.customerId), String(project.vendorId)].filter(
    (id, index, all) => id && id !== 'undefined' && all.indexOf(id) === index
  );

  emitProjectStatusUpdate(owners, projectId, project.status);
  const results = await Promise.allSettled(
    owners.map((ownerId) =>
      createAndEmitNotification(
        ownerId,
        'project_access_request',
        'Access request',
        `${requesterName} asked for access to ${project.title}`,
        {
          projectId,
          requestId: String(request._id),
          requesterName,
          projectTitle: project.title,
          ...(message ? { messagePreview: message.slice(0, 140) } : {})
        },
        `/projects/${projectId}?accessRequests=1`
      )
    )
  );
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Failed to notify about access request:', result.reason);
    }
  }

  return { request: serializeOwnRequest(request) };
});

/**
 * Pending requests, for people who can invite.
 * GET /api/remote-projects/:projectId/access-requests
 */
const listAccessRequests = handleRequest(async (req: Request) => {
  const project = await loadProject(req.params.projectId);
  assertProjectAccess(project, getAuthUserId(req as AuthRequest), 'invite');

  const requests = await ProjectAccessRequestModel.find({ projectId: project._id, status: 'pending' })
    .sort({ createdAt: 1 })
    .populate('userId', 'name email picture avatar');
  return {
    accessRequests: requests.map((r) => ({
      _id: r._id,
      userId: r.userId,
      message: r.message ?? null,
      status: r.status,
      createdAt: r.createdAt
    }))
  };
});

async function loadPendingRequest(project: ProjectDoc, requestId: string) {
  if (!mongoose.Types.ObjectId.isValid(requestId)) throw new ExpressError('Request not found', 404);
  const request = await ProjectAccessRequestModel.findOne({ _id: requestId, projectId: project._id });
  if (!request) throw new ExpressError('Request not found', 404);
  if (request.status !== 'pending') throw new ExpressError('This request was already handled', 409);
  return request;
}

/**
 * Let the requester in on the approver's side with the chosen access level.
 * POST /api/remote-projects/:projectId/access-requests/:requestId/approve  { role?, capabilities?, fileIds? }
 */
const approveAccessRequest = handleRequest(async (req: Request) => {
  const approverId = getAuthUserId(req as AuthRequest);
  const project = await loadProject(req.params.projectId);
  const access = assertProjectAccess(project, approverId, 'invite');
  const request = await loadPendingRequest(project, req.params.requestId);
  const projectId = String(project._id);
  const requesterId = String(request.userId);

  const body = (req.body ?? {}) as { role?: unknown; capabilities?: unknown; fileIds?: unknown };
  const grant = await parseProjectGrant(
    { ...body, role: body.role ?? (body.capabilities === undefined ? DEFAULT_APPROVAL_ROLE : undefined) },
    projectId
  );
  assertGrantWithinAccess(access, grant);

  if (!isParticipant(project, requesterId)) {
    assertCollaboratorCapacity(project, access.side);
    upsertCollaborator(project, {
      userId: new mongoose.Types.ObjectId(requesterId),
      side: access.side,
      invitedBy: new mongoose.Types.ObjectId(approverId),
      capabilities: grant.capabilities,
      fileIds: grant.fileIds
    });
    await project.save();
  }

  request.status = 'approved';
  request.decidedBy = approverId;
  request.decidedAt = new Date();
  request.side = access.side;
  request.capabilities = grant.capabilities;
  await request.save();

  emitProjectStatusUpdate(getProjectParticipantIds(project), projectId, project.status);
  try {
    await createAndEmitNotification(
      requesterId,
      'project_access_granted',
      'Access granted',
      `You now have access to ${project.title}`,
      { projectId, projectTitle: project.title },
      `/projects/${projectId}`
    );
  } catch (error) {
    console.error('Failed to notify requester about granted access:', error);
  }

  return { approved: true, ...serializeGrant(grant, grant.capabilities) };
});

/**
 * POST /api/remote-projects/:projectId/access-requests/:requestId/deny
 */
const denyAccessRequest = handleRequest(async (req: Request) => {
  const userId = getAuthUserId(req as AuthRequest);
  const project = await loadProject(req.params.projectId);
  assertProjectAccess(project, userId, 'invite');
  const request = await loadPendingRequest(project, req.params.requestId);

  request.status = 'denied';
  request.decidedBy = userId;
  request.decidedAt = new Date();
  await request.save();

  const owners = [String(project.customerId), String(project.vendorId)];
  emitProjectStatusUpdate(owners, String(project._id), project.status);
  return { denied: true };
});

export default {
  getMyAccessRequest,
  requestAccess,
  listAccessRequests,
  approveAccessRequest,
  denyAccessRequest
};
