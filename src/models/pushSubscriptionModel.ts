import mongoose, { Model, Schema, Document } from 'mongoose';

export interface PushSubscriptionDoc {
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: Date;
}

const PushSubscriptionSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  endpoint: {
    type: String,
    required: true,
    unique: true,
  },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
}, { timestamps: true });

// Compound index for fast lookup
PushSubscriptionSchema.index({ userId: 1, endpoint: 1 });

export const PushSubscriptionModel: Model<PushSubscriptionDoc & Document> =
  mongoose.models.PushSubscription ||
  mongoose.model<PushSubscriptionDoc & Document>('PushSubscription', PushSubscriptionSchema);
