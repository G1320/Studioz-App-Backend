import mongoose, { Model, Schema, Document } from 'mongoose';
import { RemoteProject } from '../types/remoteProject.js';

const translationSchema = new Schema(
  {
    en: { type: String, required: false },
    he: { type: String, required: false },
  },
  { _id: false }
);

// Payment details schema (reused from reservations)
const paymentDetailsSchema = new mongoose.Schema(
  {
    sumitCustomerId: { type: String },
    sumitCreditCardToken: { type: String },
    lastFourDigits: { type: String },
    amount: { type: Number },
    currency: { type: String, default: 'ILS' },
    sumitPaymentId: { type: String },
    chargedAt: { type: Date },
    failureReason: { type: String },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    refundId: { type: String },
    refundedAt: { type: Date },
  },
  { _id: false }
);

const RemoteProjectSchema = new mongoose.Schema(
  {
    // References
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Studio',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Project Details
    title: { type: String, required: true },
    brief: { type: String, required: true },
    referenceLinks: [{ type: String }],

    // Item snapshot (for historical accuracy)
    itemName: { type: translationSchema, required: false },
    studioName: { type: translationSchema, required: false },

    // Pricing
    price: { type: Number, required: true },
    depositAmount: { type: Number, required: false },
    depositPaid: { type: Boolean, default: false },
    finalPaid: { type: Boolean, default: false },

    // Timeline
    estimatedDeliveryDays: { type: Number, required: true },
    deadline: { type: Date, required: false },
    acceptedAt: { type: Date, required: false },
    deliveredAt: { type: Date, required: false },
    completedAt: { type: Date, required: false },

    // Revisions
    revisionsIncluded: { type: Number, required: true, default: 1 },
    revisionsUsed: { type: Number, default: 0 },
    revisionPrice: { type: Number, required: false },

    // Status
    status: {
      type: String,
      enum: [
        'requested',
        'accepted',
        'in_progress',
        'delivered',
        'revision_requested',
        'completed',
        'cancelled',
        'declined',
      ],
      default: 'requested',
    },

    // Payment (reuse existing structure from reservations)
    paymentStatus: {
      type: String,
      enum: ['pending', 'deposit_paid', 'fully_paid', 'refunded'],
      required: false,
    },
    paymentDetails: { type: paymentDetailsSchema, required: false },

    // Customer Info
    customerName: { type: String, required: false },
    customerEmail: { type: String, required: false },
    customerPhone: { type: String, required: false },
  },
  { timestamps: true }
);

// Database indexes for query performance
RemoteProjectSchema.index({ status: 1 });
RemoteProjectSchema.index({ itemId: 1 });
RemoteProjectSchema.index({ studioId: 1 });
RemoteProjectSchema.index({ customerId: 1 });
RemoteProjectSchema.index({ vendorId: 1 });
RemoteProjectSchema.index({ deadline: 1 });
RemoteProjectSchema.index({ createdAt: -1 });

const RemoteProjectModel: Model<RemoteProject & Document> =
  mongoose.models.RemoteProject ||
  mongoose.model<RemoteProject & Document>('RemoteProject', RemoteProjectSchema);

export { RemoteProjectModel };
