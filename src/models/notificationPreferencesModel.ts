import mongoose, { Model, Schema, Document } from 'mongoose';

export interface ChannelPreferences {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export interface NotificationPreferencesDoc {
  userId: mongoose.Types.ObjectId;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  perCategory: {
    bookings: ChannelPreferences;
    payments: ChannelPreferences;
    reviews: ChannelPreferences;
    billing: ChannelPreferences;
    projects: ChannelPreferences;
    system: ChannelPreferences;
    activity: ChannelPreferences;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

const channelPreferencesSchema = new Schema({
  inApp: { type: Boolean, default: true },
  email: { type: Boolean, default: true },
  push: { type: Boolean, default: false },
}, { _id: false });

const NotificationPreferencesSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: false },
  },
  perCategory: {
    bookings: { type: channelPreferencesSchema, default: () => ({ inApp: true, email: true, push: true }) },
    payments: { type: channelPreferencesSchema, default: () => ({ inApp: true, email: true, push: true }) },
    reviews: { type: channelPreferencesSchema, default: () => ({ inApp: true, email: true, push: false }) },
    billing: { type: channelPreferencesSchema, default: () => ({ inApp: true, email: true, push: true }) },
    projects: { type: channelPreferencesSchema, default: () => ({ inApp: true, email: true, push: true }) },
    system: { type: channelPreferencesSchema, default: () => ({ inApp: true, email: false, push: false }) },
    activity: { type: channelPreferencesSchema, default: () => ({ inApp: true, email: false, push: false }) },
  },
  quietHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '22:00' },
    end: { type: String, default: '08:00' },
    timezone: { type: String, default: 'Asia/Jerusalem' },
  },
}, { timestamps: true });

export const NotificationPreferencesModel: Model<NotificationPreferencesDoc & Document> =
  mongoose.models.NotificationPreferences ||
  mongoose.model<NotificationPreferencesDoc & Document>('NotificationPreferences', NotificationPreferencesSchema);
