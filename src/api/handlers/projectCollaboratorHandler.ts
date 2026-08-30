import crypto from 'crypto';
import { Request } from 'express';
import mongoose from 'mongoose';
import { RemoteProjectModel } from '../../models/remoteProjectModel.js';
import { ProjectInviteModel } from '../../models/projectInviteModel.js';
import { UserModel } from '../../models/userModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { sendHtmlEmail } from './emailHandler.js';
import { renderEmail } from '../../emails/render.js';
import { FRONTEND_URL } from '../../config/index.js';
import {
  assertProjectAccess,
  getAuthUserId,
  COLLABORATOR_CAP_PER_SIDE,
  INVITE_TTL_DAYS,
  type ProjectSide
} from '../../services/projectAccessService.js';

interface AuthRequest extends Request {
  decodedJwt?: { _id?: string; userId?: string };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function idStr(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

async function sendInviteEmail(params: {
  toEmail: string;
  inviterName: string;
  projectTitle: string;
  studioName?: string;
  side: ProjectSide;
  token: string;
}) {
  const inviteUrl = `${FRONTEND_URL}/he/projects/invites/${params.token}`;
  const { html, subject } = await renderEmail('PROJECT_COLLABORATOR_INVITE', {
    inviteeEmail: params.toEmail,
    inviterName: params.inviterName,
    projectTitle: params.projectTitle,
    studioName: params.studioName,
    side: params.side,
    inviteUrl,
    expiresInLabel: `${INVITE_TTL_DAYS} ימים`
  });
  await sendHtmlEmail({
    to: [{ email: params.toEmail }],
    subject,
    htmlContent: html
  });
}

/**
 * Invite a collaborator by email (primary customer/vendor only).
 * POST /api/remote-projects/:projectId/collaborators/invite
 */
const inviteCollaborator = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { email } = req.body;
  const userId = getAuthUserId(req as AuthRequest);

  if (!email || typeof email !== 'string') {
    throw new ExpressError('Email is required', 400);
  }
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ExpressError('Invalid email', 400);
  }

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  const access = assertProjectAccess(project, userId, 'invite');
  const side = access.side;

  const inviter = await UserModel.findById(userId);
  if (inviter?.email && normalizeEmail(inviter.email) === normalized) {
    throw new ExpressError('Cannot invite yourself', 400);
  }

  // Block inviting existing primary parties
  const customer = await UserModel.findById(project.customerId).select('email');
  const vendor = await UserModel.findById(project.vendorId).select('email');
  if (customer?.email && normalizeEmail(customer.email) === normalized) {
    throw new ExpressError('User is already the project customer', 400);
  }
  if (vendor?.email && normalizeEmail(vendor.email) === normalized) {
    throw new ExpressError('User is already the project vendor', 400);
  }

  // Block inviting active collaborators
  const existingUser = await UserModel.findOne({ email: normalized }).select('_id');
  if (existingUser) {
    const already = (project.collaborators || []).find(
      (c) => c.status === 'active' && idStr(c.userId) === existingUser._id.toString()
    );
    if (already) {
      throw new ExpressError('User is already a collaborator on this project', 400);
    }
  }

  const activeOnSide = (project.collaborators || []).filter(
    (c) => c.status === 'active' && c.side === side
  ).length;
  const pendingOnSide = await ProjectInviteModel.countDocuments({
    projectId,
    side,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
  if (activeOnSide + pendingOnSide >= COLLABORATOR_CAP_PER_SIDE) {
    throw new ExpressError(`Maximum ${COLLABORATOR_CAP_PER_SIDE} collaborators per side`, 400);
  }

  const rawToken = createRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  let invite = await ProjectInviteModel.findOne({
    projectId,
    email: normalized,
    status: 'pending'
  });

  if (invite) {
    invite.tokenHash = tokenHash;
    invite.expiresAt = expiresAt;
    invite.invitedBy = new mongoose.Types.ObjectId(userId) as any;
    invite.side = side;
    await invite.save();
  } else {
    invite = await ProjectInviteModel.create({
      projectId,
      email: normalized,
      side,
      invitedBy: userId,
      tokenHash,
      status: 'pending',
      expiresAt
    });
  }

  await sendInviteEmail({
    toEmail: normalized,
    inviterName: inviter?.name || 'Studioz',
    projectTitle: project.title,
    studioName: project.studioName?.he || project.studioName?.en,
    side,
    token: rawToken
  });

  return {
    invite: {
      _id: invite._id,
      email: invite.email,
      side: invite.side,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt
    }
  };
});

/**
 * List collaborators + pending invites
 * GET /api/remote-projects/:projectId/collaborators
 */
const listCollaborators = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const userId = getAuthUserId(req as AuthRequest);

  const project = await RemoteProjectModel.findById(projectId)
    .populate('collaborators.userId', 'name email imgUrl')
    .populate('collaborators.invitedBy', 'name email');
  if (!project) throw new ExpressError('Project not found', 404);
  assertProjectAccess(project, userId, 'view');

  const pending = await ProjectInviteModel.find({
    projectId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  })
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });

  const collaborators = (project.collaborators || [])
    .filter((c) => c.status === 'active')
    .map((c) => ({
      userId: c.userId,
      side: c.side,
      invitedBy: c.invitedBy,
      joinedAt: c.joinedAt,
      status: c.status
    }));

  return { collaborators, pendingInvites: pending };
});

/**
 * Remove a collaborator (primary on same side, or self-leave)
 * DELETE /api/remote-projects/:projectId/collaborators/:userId
 */
const removeCollaborator = handleRequest(async (req: Request) => {
  const { projectId, userId: targetUserId } = req.params;
  const actorId = getAuthUserId(req as AuthRequest);

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  const access = assertProjectAccess(project, actorId, 'view');
  const target = (project.collaborators || []).find(
    (c) => c.status === 'active' && idStr(c.userId) === String(targetUserId)
  );
  if (!target) throw new ExpressError('Collaborator not found', 404);

  const isSelf = actorId === String(targetUserId);
  const canRemoveOther = access.canInvite && access.side === target.side;
  if (!isSelf && !canRemoveOther) {
    throw new ExpressError('Forbidden', 403);
  }

  target.status = 'removed';
  await project.save();

  return { removed: true };
});

/**
 * Revoke a pending invite
 * POST /api/remote-projects/:projectId/collaborators/invites/:inviteId/revoke
 */
const revokeInvite = handleRequest(async (req: Request) => {
  const { projectId, inviteId } = req.params;
  const userId = getAuthUserId(req as AuthRequest);

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  const access = assertProjectAccess(project, userId, 'invite');

  const invite = await ProjectInviteModel.findOne({ _id: inviteId, projectId });
  if (!invite) throw new ExpressError('Invite not found', 404);
  if (invite.side !== access.side) {
    throw new ExpressError('Forbidden', 403);
  }
  if (invite.status !== 'pending') {
    throw new ExpressError('Invite is not pending', 400);
  }

  invite.status = 'revoked';
  await invite.save();

  return { revoked: true };
});

/**
 * Public-ish invite preview (auth optional but route sits behind verifyToken for now —
 * accept flow uses authenticated accept; preview also requires auth per plan accept UI after login).
 * GET /api/remote-projects/invites/:token
 */
const getInviteByToken = handleRequest(async (req: Request) => {
  const { token } = req.params;
  if (!token) throw new ExpressError('Token is required', 400);

  const invite = await ProjectInviteModel.findOne({ tokenHash: hashToken(token) })
    .populate('invitedBy', 'name email')
    .populate('projectId', 'title status studioName');

  if (!invite) throw new ExpressError('Invite not found', 404);

  if (invite.status === 'pending' && invite.expiresAt < new Date()) {
    invite.status = 'expired';
    await invite.save();
  }

  const project = invite.projectId as any;

  return {
    invite: {
      _id: invite._id,
      email: invite.email,
      side: invite.side,
      status: invite.status,
      expiresAt: invite.expiresAt,
      invitedBy: invite.invitedBy,
      project: project
        ? {
            _id: project._id,
            title: project.title,
            status: project.status,
            studioName: project.studioName
          }
        : null
    }
  };
});

/**
 * Accept invite (auth required; email must match)
 * POST /api/remote-projects/invites/:token/accept
 */
const acceptInvite = handleRequest(async (req: Request) => {
  const { token } = req.params;
  const userId = getAuthUserId(req as AuthRequest);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);
  if (!user.email) throw new ExpressError('Your account has no email on file', 400);

  const invite = await ProjectInviteModel.findOne({ tokenHash: hashToken(token) });
  if (!invite) throw new ExpressError('Invite not found', 404);

  if (invite.status !== 'pending') {
    throw new ExpressError(`Invite is ${invite.status}`, 400);
  }
  if (invite.expiresAt < new Date()) {
    invite.status = 'expired';
    await invite.save();
    throw new ExpressError('Invite has expired', 400);
  }

  if (normalizeEmail(user.email) !== normalizeEmail(invite.email)) {
    throw new ExpressError('This invite was sent to a different email address', 403);
  }

  const project = await RemoteProjectModel.findById(invite.projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  // Cannot accept if already a primary party
  if (
    idStr(project.customerId) === userId ||
    idStr(project.vendorId) === userId
  ) {
    throw new ExpressError('You are already a primary participant on this project', 400);
  }

  const existing = (project.collaborators || []).find(
    (c) => idStr(c.userId) === userId && c.status === 'active'
  );
  if (existing) {
    invite.status = 'accepted';
    invite.acceptedUserId = user._id as any;
    invite.acceptedAt = new Date();
    await invite.save();
    return { projectId: project._id, alreadyMember: true };
  }

  // Cap check
  const activeOnSide = (project.collaborators || []).filter(
    (c) => c.status === 'active' && c.side === invite.side
  ).length;
  if (activeOnSide >= COLLABORATOR_CAP_PER_SIDE) {
    throw new ExpressError(`Maximum ${COLLABORATOR_CAP_PER_SIDE} collaborators per side`, 400);
  }

  const removed = (project.collaborators || []).find(
    (c) => idStr(c.userId) === userId && c.status === 'removed'
  );
  if (removed) {
    removed.status = 'active';
    removed.side = invite.side;
    removed.invitedBy = invite.invitedBy as any;
    removed.joinedAt = new Date();
  } else {
    const collaborators = project.collaborators ?? [];
    collaborators.push({
      userId: user._id as any,
      side: invite.side,
      invitedBy: invite.invitedBy as any,
      joinedAt: new Date(),
      status: 'active'
    } as any);
    project.collaborators = collaborators as any;
  }

  await project.save();

  invite.status = 'accepted';
  invite.acceptedUserId = user._id as any;
  invite.acceptedAt = new Date();
  await invite.save();

  return { projectId: project._id, alreadyMember: false };
});

/**
 * Pending invites for the logged-in user's email
 * GET /api/remote-projects/invites/pending
 */
const listPendingInvitesForUser = handleRequest(async (req: Request) => {
  const userId = getAuthUserId(req as AuthRequest);
  const user = await UserModel.findById(userId).select('email');
  if (!user?.email) return { invites: [] };

  const invites = await ProjectInviteModel.find({
    email: normalizeEmail(user.email),
    status: 'pending',
    expiresAt: { $gt: new Date() }
  })
    .populate('invitedBy', 'name email')
    .populate('projectId', 'title status studioName')
    .sort({ createdAt: -1 });

  return { invites };
});

export default {
  inviteCollaborator,
  listCollaborators,
  removeCollaborator,
  revokeInvite,
  getInviteByToken,
  acceptInvite,
  listPendingInvitesForUser
};
