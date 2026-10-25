import { NotificationModel } from '../models/notificationModel.js';
import Notification, {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NOTIFICATION_TYPE_CATEGORY,
  NOTIFICATION_TYPE_PRIORITY
} from '../types/notification.js';
import mongoose from 'mongoose';

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    reservationId?: string;
    itemId?: string;
    studioId?: string;
    [key: string]: any;
  };
  priority?: NotificationPriority;
  actionUrl?: string;
  expiresAt?: Date;
  groupKey?: string;
}

const activeFilter = { archivedAt: null };
const archivedFilter = { archivedAt: { $exists: true, $ne: null } };

export const createNotification = async (notificationData: CreateNotificationData): Promise<Notification> => {
  const category = NOTIFICATION_TYPE_CATEGORY[notificationData.type] || 'system';
  const priority = notificationData.priority
    || NOTIFICATION_TYPE_PRIORITY[notificationData.type]
    || 'medium';

  const notification = new NotificationModel({
    userId: notificationData.userId,
    type: notificationData.type,
    category,
    title: notificationData.title,
    message: notificationData.message,
    data: notificationData.data || {},
    priority,
    actionUrl: notificationData.actionUrl,
    expiresAt: notificationData.expiresAt,
    groupKey: notificationData.groupKey,
    read: false,
    archivedAt: null
  });

  await notification.save();
  return notification.toObject() as Notification;
};

export const getUserNotifications = async (
  userId: string,
  options: {
    read?: boolean;
    archived?: boolean;
    category?: NotificationCategory;
    types?: NotificationType[];
    limit?: number;
    offset?: number;
    cursor?: string;
  } = {}
): Promise<Notification[]> => {
  const { read, archived = false, category, types, limit = 20, offset = 0, cursor } = options;

  const query: any = {
    userId: new mongoose.Types.ObjectId(userId),
    ...(archived ? archivedFilter : activeFilter)
  };

  if (read !== undefined) {
    query.read = read;
  }

  if (category) {
    query.category = category;
  }

  if (types?.length) {
    query.type = { $in: types };
  }

  // Cursor-based pagination: fetch notifications older than cursor
  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  const notifications = await NotificationModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(cursor ? 0 : offset)
    .lean();

  return notifications as Notification[];
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  const count = await NotificationModel.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    read: false,
    ...activeFilter
  });

  return count;
};

export const markAsRead = async (notificationId: string, userId: string): Promise<Notification | null> => {
  const notification = await NotificationModel.findOneAndUpdate(
    {
      _id: notificationId,
      userId: new mongoose.Types.ObjectId(userId),
      ...activeFilter
    },
    {
      read: true,
      readAt: new Date()
    },
    { new: true }
  ).lean();

  if (!notification) {
    return null;
  }

  return notification as Notification;
};

export const markAllAsRead = async (userId: string): Promise<{ modifiedCount: number }> => {
  const result = await NotificationModel.updateMany(
    {
      userId: new mongoose.Types.ObjectId(userId),
      read: false,
      ...activeFilter
    },
    {
      read: true,
      readAt: new Date()
    }
  );

  return { modifiedCount: result.modifiedCount };
};

export const archiveNotification = async (
  notificationId: string,
  userId: string
): Promise<Notification | null> => {
  const notification = await NotificationModel.findOneAndUpdate(
    {
      _id: notificationId,
      userId: new mongoose.Types.ObjectId(userId),
      ...activeFilter
    },
    {
      $set: { archivedAt: new Date() },
      $unset: { expiresAt: 1 }
    },
    { new: true }
  ).lean();

  if (!notification) {
    return null;
  }

  return notification as Notification;
};

export const archiveAllRead = async (userId: string): Promise<{ archivedCount: number }> => {
  const result = await NotificationModel.updateMany(
    {
      userId: new mongoose.Types.ObjectId(userId),
      read: true,
      ...activeFilter
    },
    {
      $set: { archivedAt: new Date() },
      $unset: { expiresAt: 1 }
    }
  );

  return { archivedCount: result.modifiedCount };
};

export const restoreNotification = async (
  notificationId: string,
  userId: string
): Promise<Notification | null> => {
  const notification = await NotificationModel.findOneAndUpdate(
    {
      _id: notificationId,
      userId: new mongoose.Types.ObjectId(userId),
      ...archivedFilter
    },
    {
      $set: { archivedAt: null }
    },
    { new: true }
  ).lean();

  if (!notification) {
    return null;
  }

  return notification as Notification;
};

export const deleteNotification = async (notificationId: string, userId: string): Promise<boolean> => {
  const result = await NotificationModel.deleteOne({
    _id: notificationId,
    userId: new mongoose.Types.ObjectId(userId),
    ...archivedFilter
  });

  return result.deletedCount === 1;
};
