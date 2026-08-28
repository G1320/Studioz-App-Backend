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
  const { page: pageStr, limit: limitStr, since } = req.query;

  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);
  assertProjectAccess(project, getAuthUserId(req as AuthRequest), 'view');

  const projectObjectId = new mongoose.Types.ObjectId(projectId);

  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr as string) || 50));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { projectId: projectObjectId };

  if (since) {
    filter.createdAt = { $gt: new Date(since as string) };
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
  const { message, attachmentIds, fileId, offsetSeconds } = req.body;
  const senderId = getAuthUserId(req as AuthRequest);

  if (!message || message.trim() === '') {
    throw new ExpressError('Message content is required', 400);
  }

  const hasCue =
    fileId !== undefined &&
    fileId !== null &&
    fileId !== '' &&
    offsetSeconds !== undefined &&
    offsetSeconds !== null;

  if (hasCue) {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new ExpressError('Invalid file ID', 400);
    }
    const offset = Number(offsetSeconds);
    if (!Number.isFinite(offset) || offset < 0) {
      throw new ExpressError('offsetSeconds must be a non-negative number', 400);
    }
  } else if (fileId || offsetSeconds !== undefined) {
    throw new ExpressError('Time-coded comments require both fileId and offsetSeconds', 400);
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

  if (hasCue) {
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
    ...(hasCue ? { fileId, offsetSeconds: Number(offsetSeconds) } : {})
  });

  await projectMessage.save();

  await projectMessage.populate('senderId', 'name imgUrl');
  if (hasCue) {
    await projectMessage.populate('fileId', 'fileName fileSize mimeType');
  }

  emitProjectMessageUpdate(getProjectParticipantIds(project), projectId);

  return projectMessage;
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
  markAsRead
};
