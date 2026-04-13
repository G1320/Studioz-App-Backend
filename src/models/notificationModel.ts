import mongoose, { Document, Model, Schema } from 'mongoose';
import Notification, { NotificationType, NotificationCategory, NotificationPriority } from '../types/notification.js';

const NOTIFICATION_TYPES: NotificationType[] = [
  // Bookings
  'new_reservation',
  'reservation_confirmed',
  'reservation_cancelled',
  'reservation_expired',
  'reservation_modified',
  'reservation_reminder',
  // Payments
  'payout_completed',
  'payout_failed',
  // Reviews
  'new_review',
  // Billing
  'subscription_trial_ending',
  'subscription_payment_failed',
  'subscription_renewed',
  // System
  'calendar_sync_error',
  'platform_announcement',
  'weekly_summary',
  'system_alert',
  // Activity
  'customer_message',
  'new_remote_project',
  'availability_alert',
];

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'bookings',
  'payments',
  'reviews',
  'billing',
  'projects',
  'system',
  'activity',
];

const NotificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true
    },
    category: {
      type: String,
      enum: NOTIFICATION_CATEGORIES,
      required: true,
      default: 'system'
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    data: {
      type: Schema.Types.Mixed,
      required: false
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      required: false
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    actionUrl: {
      type: String,
      required: false
    },
    expiresAt: {
      type: Date,
      required: false
    },
    groupKey: {
      type: String,
      required: false
    }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }); // For cleanup jobs
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true }); // TTL index for auto-expiry

const NotificationModel: Model<Notification & Document> =
  mongoose.models.Notification ||
  mongoose.model<Notification & Document>('Notification', NotificationSchema);

export { NotificationModel };
