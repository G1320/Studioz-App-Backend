import { NotificationModel } from '../models/notificationModel.js';
import Notification, { NotificationType, NotificationPriority } from '../types/notification.js';
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
}

export const createNotification = async (notificationData: CreateNotificationData): Promise<Notification> => {
  const notification = new NotificationModel({
    userId: notificationData.userId,
    type: notificationData.type,
    title: notificationData.title,
    message: notificationData.message,
    data: notificationData.data || {},
    priority: notificationData.priority || 'medium',
    actionUrl: notificationData.actionUrl,
    read: false
  });

  await notification.save();
  return notification.toObject() as Notification;
};

export const getUserNotifications = async (
  userId: string,
  options: {
    read?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Notification[]> => {
  const { read, limit = 20, offset = 0 } = options;

  const query: any = { userId: new mongoose.Types.ObjectId(userId) };
  
  if (read !== undefined) {
    query.read = read;
  }

  const notifications = await NotificationModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .lean();

  return notifications as Notification[];
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  const count = await NotificationModel.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    read: false
  });

  return count;
};

export const markAsRead = async (notificationId: string, userId: string): Promise<Notification | null> => {
  const notification = await NotificationModel.findOneAndUpdate(
    {
      _id: notificationId,
      userId: new mongoose.Types.ObjectId(userId)
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
      read: false
    },
    {
      read: true,
      readAt: new Date()
    }
  );

  return { modifiedCount: result.modifiedCount };
};

export const deleteNotification = async (notificationId: string, userId: string): Promise<boolean> => {
  const result = await NotificationModel.deleteOne({
    _id: notificationId,
    userId: new mongoose.Types.ObjectId(userId)
  });

  return result.deletedCount === 1;
};

export const deleteAllRead = async (userId: string): Promise<{ deletedCount: number }> => {
  const result = await NotificationModel.deleteMany({
    userId: new mongoose.Types.ObjectId(userId),
    read: true
  });

  return { deletedCount: result.deletedCount || 0 };
};

