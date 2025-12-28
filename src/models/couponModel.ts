import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses: number;
  usedCount: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  applicablePlans: string[]; // 'all', 'starter', 'pro', etc.
  minPurchaseAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
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
    applicablePlans: {
      type: [String],
      default: ['all'] // 'all' means applicable to all plans
    },
    minPurchaseAmount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Index for faster lookups
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, validUntil: 1 });

export const CouponModel: Model<ICoupon> = mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', couponSchema);
export default CouponModel;
