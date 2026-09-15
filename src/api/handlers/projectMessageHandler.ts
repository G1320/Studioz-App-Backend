import { Request } from 'express';
import mongoose from 'mongoose';
import { ProjectMessageModel } from '../../models/projectMessageModel.js';
import { ProjectFileModel } from '../../models/projectFileModel.js';
import { RemoteProjectModel } from '../../models/remoteProjectModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { emitProjectMessageUpdate } from '../../webSockets/socket.js';
import {
  assertProjectAccess,
  getAuthUserId,
  getProjectParticipantIds,
  oppositeSenderRoles,
  type ProjectSenderRole
} from '../../services/projectAccessService.js';

interface AuthRequest extends Request {
  decodedJwt?: { _id?: string; userId?: string };
}

/**
 * Get messages for a project
 * GET /api/remote-projects/:projectId/messages
 */
const getMessages = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { page: pageStr, limit: limitStr, since, fileId: fileIdFilter } = req.query;

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  assertProjectAccess(project, getAuthUserId(req as AuthRequest), 'view');

  const projectObjectId = new mongoose.Types.ObjectId(projectId);

  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(limitStr as string) || 50));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { projectId: projectObjectId };

  if (since) {
    filter.createdAt = { $gt: new Date(since as string) };
  }

  // Per-track thread: `fileId=<id>`; general chat only: `fileId=none`
  if (typeof fileIdFilter === 'string' && fileIdFilter) {
    if (fileIdFilter === 'none') {
      filter.fileId = { $exists: false };
    } else if (mongoose.Types.ObjectId.isValid(fileIdFilter)) {
      filter.fileId = new mongoose.Types.ObjectId(fileIdFilter);
    } else {
      throw new ExpressError('Invalid file ID filter', 400);
    }
  }

  const [messages, total] = await Promise.all([
    ProjectMessageModel.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'name imgUrl')
      .populate('attachmentIds', 'fileName fileSize mimeType')
      .populate('fileId', 'fileName fileSize mimeType'),
    ProjectMessageModel.countDocuments(filter)
  ]);

  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
});

/**
 * Send a message in a project
 * POST /api/remote-projects/:projectId/messages
 */
const sendMessage = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { message, attachmentIds, offsetSeconds, parentId } = req.body;
  let { fileId } = req.body;
  const senderId = getAuthUserId(req as AuthRequest);

  if (!message || message.trim() === '') {
    throw new ExpressError('Message content is required', 400);
  }

  const hasFile = fileId !== undefined && fileId !== null && fileId !== '';
  const hasOffset = offsetSeconds !== undefined && offsetSeconds !== null && offsetSeconds !== '';
  const hasParent = parentId !== undefined && parentId !== null && parentId !== '';

  if (hasFile && !mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ExpressError('Invalid file ID', 400);
  }
  if (hasOffset) {
    if (!hasFile && !hasParent) {
      throw new ExpressError('Time-coded comments require a fileId', 400);
    }
    const offset = Number(offsetSeconds);
    if (!Number.isFinite(offset) || offset < 0) {
      throw new ExpressError('offsetSeconds must be a non-negative number', 400);
    }
  }
  if (hasParent && !mongoose.Types.ObjectId.isValid(parentId)) {
    throw new ExpressError('Invalid parent message ID', 400);
  }

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  const access = assertProjectAccess(project, senderId, 'chat');
  const senderRole: ProjectSenderRole = access.senderRole;

  if (attachmentIds && attachmentIds.length > 0) {
    for (const attachmentId of attachmentIds) {
      if (!mongoose.Types.ObjectId.isValid(attachmentId)) {
        throw new ExpressError(`Invalid attachment ID: ${attachmentId}`, 400);
      }
    }
  }

  const projectObjectId = new mongoose.Types.ObjectId(projectId);

  // Replies inherit the parent's track so a thread never straddles files.
  if (hasParent) {
    const parent = await ProjectMessageModel.findOne({ _id: parentId, projectId: projectObjectId });
    if (!parent) throw new ExpressError('Parent message not found on this project', 404);
    if (parent.parentId) {
      throw new ExpressError('Replies can only be one level deep', 400);
    }
    if (!parent.fileId) {
      throw new ExpressError('Only track comments can have threaded replies', 400);
    }
    if (hasFile && String(parent.fileId) !== String(fileId)) {
      throw new ExpressError('Reply must belong to the same track as its parent', 400);
    }
    fileId = String(parent.fileId);
  }

  const resolvedHasFile = fileId !== undefined && fileId !== null && fileId !== '';

  if (resolvedHasFile) {
    const file = await ProjectFileModel.findOne({
      _id: fileId,
      projectId: projectObjectId
    });
    if (!file) throw new ExpressError('File not found on this project', 404);
  }

  const projectMessage = new ProjectMessageModel({
    projectId: projectObjectId,
    senderId,
    senderRole,
    message: message.trim(),
    attachmentIds: attachmentIds || [],
    ...(resolvedHasFile ? { fileId } : {}),
    ...(resolvedHasFile && hasOffset ? { offsetSeconds: Number(offsetSeconds) } : {}),
    ...(hasParent ? { parentId } : {})
  });

  await projectMessage.save();

  await projectMessage.populate('senderId', 'name imgUrl');
  if (resolvedHasFile) {
    await projectMessage.populate('fileId', 'fileName fileSize mimeType');
  }

  emitProjectMessageUpdate(getProjectParticipantIds(project), projectId);

  return projectMessage;
});

/**
 * Mark a track comment as resolved / unresolved
 * PATCH /api/remote-projects/:projectId/messages/:messageId/resolve  { resolved: boolean }
 */
const setResolved = handleRequest(async (req: Request) => {
  const { projectId, messageId } = req.params;
  const { resolved } = req.body;
  const userId = getAuthUserId(req as AuthRequest);

  if (typeof resolved !== 'boolean') {
    throw new ExpressError('resolved must be a boolean', 400);
  }
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new ExpressError('Invalid message ID', 400);
  }

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  // Resolving review feedback is a vendor-side moderation action.
  assertProjectAccess(project, userId, 'update_metadata');

  const projectObjectId = new mongoose.Types.ObjectId(projectId);
  const msg = await ProjectMessageModel.findOne({ _id: messageId, projectId: projectObjectId });
  if (!msg) throw new ExpressError('Message not found', 404);
  if (!msg.fileId) throw new ExpressError('Only track comments can be resolved', 400);
  if (msg.parentId) throw new ExpressError('Resolve the top-level comment instead', 400);

  if (resolved) {
    msg.resolvedAt = new Date();
    msg.resolvedBy = userId;
  } else {
    msg.resolvedAt = undefined;
    msg.resolvedBy = undefined;
  }
  await msg.save();

  emitProjectMessageUpdate(getProjectParticipantIds(project), projectId);

  return {
    _id: msg._id,
    resolvedAt: msg.resolvedAt ?? null,
    resolvedBy: msg.resolvedBy ?? null
  };
});

/**
 * Mark messages as read
 * PATCH /api/remote-projects/:projectId/messages/read
 */
const markAsRead = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { messageIds } = req.body;
  const userId = getAuthUserId(req as AuthRequest);

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  const access = assertProjectAccess(project, userId, 'view');
  const projectObjectId = new mongoose.Types.ObjectId(projectId);

  const filter: Record<string, unknown> = {
    projectId: projectObjectId,
    senderRole: { $in: oppositeSenderRoles(access.side) },
    readAt: null
  };

  if (messageIds && messageIds.length > 0) {
    filter._id = { $in: messageIds.map((id: string) => new mongoose.Types.ObjectId(id)) };
  }

  const result = await ProjectMessageModel.updateMany(filter, {
    $set: { readAt: new Date() }
  });

  return {
    markedAsRead: result.modifiedCount
  };
});

/**
 * Get unread message count for a user in a project
 */
export async function getUnreadCount(
  projectId: string,
  userId: string,
  userRole: 'customer' | 'vendor' | ProjectSenderRole
): Promise<number> {
  const side = userRole.includes('vendor') ? 'vendor' : 'customer';
  return ProjectMessageModel.countDocuments({
    projectId: new mongoose.Types.ObjectId(projectId),
    senderRole: { $in: oppositeSenderRoles(side) },
    readAt: null
  });
}

export default {
  getMessages,
  sendMessage,
  setResolved,
  markAsRead
};
