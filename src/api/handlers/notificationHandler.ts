import { Request } from 'express';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead
} from '../../services/notificationService.js';
import {
  getPreferences,
  updatePreferences
} from '../../services/notificationPreferencesService.js';
import { NotificationCategory } from '../../types/notification.js';
import {
  saveSubscription,
  removeSubscription,
  getVapidPublicKey
} from '../../services/webPushService.js';

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
  const category = req.query.category as NotificationCategory | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
  const cursor = req.query.cursor as string | undefined;

  const notifications = await getUserNotifications(userId, {
    read,
    category,
    limit,
    offset,
    cursor
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

const deleteAllReadNotifications = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?.userId || req.decodedJwt?._id || req.decodedJwt?.sub;

  if (!userId) {
    throw new ExpressError('User ID not found in token', 401);
  }

  const result = await deleteAllRead(userId);
  return result;
});

const getNotificationPreferences = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?.userId || req.decodedJwt?._id || req.decodedJwt?.sub;

  if (!userId) {
    throw new ExpressError('User ID not found in token', 401);
  }

  return getPreferences(userId);
});

const updateNotificationPreferences = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?.userId || req.decodedJwt?._id || req.decodedJwt?.sub;

  if (!userId) {
    throw new ExpressError('User ID not found in token', 401);
  }

  const { channels, perCategory, quietHours } = req.body;
  return updatePreferences(userId, { channels, perCategory, quietHours });
});

const subscribePush = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?.userId || req.decodedJwt?._id || req.decodedJwt?.sub;

  if (!userId) {
    throw new ExpressError('User ID not found in token', 401);
  }

  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new ExpressError('Invalid push subscription data', 400);
  }

  await saveSubscription(userId, { endpoint, keys });
  return { message: 'Push subscription saved' };
});

const unsubscribePush = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?.userId || req.decodedJwt?._id || req.decodedJwt?.sub;

  if (!userId) {
    throw new ExpressError('User ID not found in token', 401);
  }

  const { endpoint } = req.body;
  if (!endpoint) {
    throw new ExpressError('Endpoint is required', 400);
  }

  await removeSubscription(userId, endpoint);
  return { message: 'Push subscription removed' };
});

const getPushPublicKey = handleRequest(async () => {
  const key = getVapidPublicKey();
  if (!key) {
    throw new ExpressError('Push notifications not configured', 503);
  }
  return { publicKey: key };
});

export default {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationById,
  deleteAllReadNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  subscribePush,
  unsubscribePush,
  getPushPublicKey
};

