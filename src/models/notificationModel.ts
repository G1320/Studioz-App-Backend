import mongoose, { Document, Model, Schema } from 'mongoose';
import Notification, { NotificationType, NotificationPriority } from '../types/notification.js';

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
      enum: [
        'new_reservation',
        'reservation_confirmed',
        'reservation_cancelled',
        'reservation_expired',
        'reservation_modified',
        'reservation_reminder',
        'system_alert'
      ],
      required: true
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
    }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }); // For cleanup jobs

const NotificationModel: Model<Notification & Document> =
  mongoose.models.Notification ||
  mongoose.model<Notification & Document>('Notification', NotificationSchema);

export { NotificationModel };

