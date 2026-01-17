import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IStudioCoupon extends Document {
  code: string;
  studioId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId; // Studio owner
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses: number;
  usedCount: number;
  maxUsesPerCustomer: number; // 0 = unlimited per customer
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  applicableItems: string[]; // 'all' or specific item IDs
  minBookingHours?: number; // Minimum booking hours required
  minPurchaseAmount?: number;
  description?: string; // Optional description for the coupon
  createdAt: Date;
  updatedAt: Date;
}

const studioCouponSchema = new Schema<IStudioCoupon>(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    studioId: {
      type: Schema.Types.ObjectId,
      ref: 'Studio',
      required: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0
    },
    maxUses: {
      type: Number,
      default: 0 // 0 = unlimited
    },
    usedCount: {
      type: Number,
      default: 0
    },
    maxUsesPerCustomer: {
      type: Number,
      default: 0 // 0 = unlimited per customer
    },
    validFrom: {
      type: Date,
      required: true,
      default: Date.now
    },
    validUntil: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    applicableItems: {
      type: [String],
      default: ['all'] // 'all' means applicable to all items in the studio
    },
    minBookingHours: {
      type: Number,
      default: 0
    },
    minPurchaseAmount: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

// Compound unique index: code must be unique within a studio
studioCouponSchema.index({ code: 1, studioId: 1 }, { unique: true });

// Indexes for common queries
studioCouponSchema.index({ studioId: 1 });
studioCouponSchema.index({ createdBy: 1 });
studioCouponSchema.index({ isActive: 1 });
studioCouponSchema.index({ validFrom: 1, validUntil: 1 });

export const StudioCouponModel: Model<IStudioCoupon> =
  mongoose.models.StudioCoupon || mongoose.model<IStudioCoupon>('StudioCoupon', studioCouponSchema);

export default StudioCouponModel;
