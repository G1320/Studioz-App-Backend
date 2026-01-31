import { Request } from 'express';
import mongoose from 'mongoose';
import { ProjectMessageModel } from '../../models/projectMessageModel.js';
import { RemoteProjectModel } from '../../models/remoteProjectModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';

/**
 * Get messages for a project
 * GET /api/remote-projects/:projectId/messages
 */
const getMessages = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { page: pageStr, limit: limitStr, since } = req.query;

  // Validate project exists
  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  // Pagination
  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr as string) || 50));
  const skip = (page - 1) * limit;

  // Build filter
  const filter: Record<string, unknown> = { projectId };

  // Optionally filter messages since a timestamp (for polling)
  if (since) {
    filter.createdAt = { $gt: new Date(since as string) };
  }

  const [messages, total] = await Promise.all([
    ProjectMessageModel.find(filter)
      .sort({ createdAt: 1 }) // Oldest first for chat display
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'name imgUrl')
      .populate('attachmentIds', 'fileName fileSize mimeType'),
    ProjectMessageModel.countDocuments(filter),
  ]);

  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
});

/**
 * Send a message in a project
 * POST /api/remote-projects/:projectId/messages
 */
const sendMessage = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { senderId, message, attachmentIds } = req.body;

  if (!senderId) throw new ExpressError('Sender ID is required', 400);
  if (!message || message.trim() === '') {
    throw new ExpressError('Message content is required', 400);
  }

  // Validate project exists
  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  // Determine sender role
  let senderRole: 'customer' | 'vendor';
  if (senderId === project.customerId.toString()) {
    senderRole = 'customer';
  } else if (senderId === project.vendorId.toString()) {
    senderRole = 'vendor';
  } else {
    throw new ExpressError('Sender is not authorized for this project', 403);
  }

  // Validate attachment IDs if provided
  if (attachmentIds && attachmentIds.length > 0) {
    for (const attachmentId of attachmentIds) {
      if (!mongoose.Types.ObjectId.isValid(attachmentId)) {
        throw new ExpressError(`Invalid attachment ID: ${attachmentId}`, 400);
      }
    }
  }

  // Create message
  const projectMessage = new ProjectMessageModel({
    projectId,
    senderId,
    senderRole,
    message: message.trim(),
    attachmentIds: attachmentIds || [],
  });

  await projectMessage.save();

  // Populate sender info for response
  await projectMessage.populate('senderId', 'name imgUrl');

  // TODO: Send notification to the other party about new message
  // TODO: Emit WebSocket event for real-time updates

  return projectMessage;
});

/**
 * Mark messages as read
 * PATCH /api/remote-projects/:projectId/messages/read
 */
const markAsRead = handleRequest(async (req: Request) => {
  const { projectId } = req.params;
  const { userId, messageIds } = req.body;

  if (!userId) throw new ExpressError('User ID is required', 400);

  // Validate project exists
  const project = await RemoteProjectModel.findById(projectId);
  if (!project) throw new ExpressError('Project not found', 404);

  // Determine user role to know which messages to mark as read
  let userRole: 'customer' | 'vendor';
  if (userId === project.customerId.toString()) {
    userRole = 'customer';
  } else if (userId === project.vendorId.toString()) {
    userRole = 'vendor';
  } else {
    throw new ExpressError('User is not authorized for this project', 403);
  }

  // Mark messages from the OTHER party as read
  const oppositeRole = userRole === 'customer' ? 'vendor' : 'customer';

  const filter: Record<string, unknown> = {
    projectId,
    senderRole: oppositeRole,
    readAt: null, // Only unread messages
  };

  // If specific message IDs provided, filter to those
  if (messageIds && messageIds.length > 0) {
    filter._id = { $in: messageIds.map((id: string) => new mongoose.Types.ObjectId(id)) };
  }

  const result = await ProjectMessageModel.updateMany(filter, {
    $set: { readAt: new Date() },
  });

  return {
    markedAsRead: result.modifiedCount,
  };
});

/**
 * Get unread message count for a user in a project
 * This is a helper that could be called from getProjectById
 */
export async function getUnreadCount(
  projectId: string,
  userId: string,
  userRole: 'customer' | 'vendor'
): Promise<number> {
  const oppositeRole = userRole === 'customer' ? 'vendor' : 'customer';

  return ProjectMessageModel.countDocuments({
    projectId,
    senderRole: oppositeRole,
    readAt: null,
  });
}

export default {
  getMessages,
  sendMessage,
  markAsRead,
};
