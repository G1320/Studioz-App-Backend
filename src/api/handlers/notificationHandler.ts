import { Request } from 'express';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../../services/notificationService.js';

interface CustomRequest extends Request {
  decodedJwt?: {
    userId?: string;
    sub?: string;
    _id?: string;
  };
}

const getNotifications = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?.userId || req.decodedJwt?._id || req.decodedJwt?.sub;
  
  if (!userId) {
    throw new ExpressError('User ID not found in token', 401);
  }

  const read = req.query.read === 'true' ? true : req.query.read === 'false' ? false : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

  const notifications = await getUserNotifications(userId, {
    read,
    limit,
    offset
  });

  return notifications;
});

const getUnreadNotificationCount = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?.userId || req.decodedJwt?._id || req.decodedJwt?.sub;
  
  if (!userId) {
    throw new ExpressError('User ID not found in token', 401);
  }

  const count = await getUnreadCount(userId);
  return { count };
});

const markNotificationAsRead = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?.userId || req.decodedJwt?._id || req.decodedJwt?.sub;
  
  if (!userId) {
    throw new ExpressError('User ID not found in token', 401);
  }

  const { id } = req.params;
  if (!id) {
    throw new ExpressError('Notification ID not provided', 400);
  }

  const notification = await markAsRead(id, userId);
  
  if (!notification) {
    throw new ExpressError('Notification not found or unauthorized', 404);
  }

  return notification;
});

const markAllNotificationsAsRead = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?.userId || req.decodedJwt?._id || req.decodedJwt?.sub;
  
  if (!userId) {
    throw new ExpressError('User ID not found in token', 401);
  }

  const result = await markAllAsRead(userId);
  return result;
});

const deleteNotificationById = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?.userId || req.decodedJwt?._id || req.decodedJwt?.sub;
  
  if (!userId) {
    throw new ExpressError('User ID not found in token', 401);
  }

  const { id } = req.params;
  if (!id) {
    throw new ExpressError('Notification ID not provided', 400);
  }

  const deleted = await deleteNotification(id, userId);
  
  if (!deleted) {
    throw new ExpressError('Notification not found or unauthorized', 404);
  }

  return { message: 'Notification deleted successfully' };
});

export default {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationById
};

