import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IStudioCouponUsage extends Document {
  couponId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  studioId: mongoose.Types.ObjectId;
  reservationId?: mongoose.Types.ObjectId;
  discountAmount: number;
  usedAt: Date;
}

const studioCouponUsageSchema = new Schema<IStudioCouponUsage>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'StudioCoupon',
      required: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    studioId: {
      type: Schema.Types.ObjectId,
      ref: 'Studio',
      required: true
    },
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation'
    },
    discountAmount: {
      type: Number,
      required: true
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Indexes for efficient lookups
studioCouponUsageSchema.index({ couponId: 1, customerId: 1 });
studioCouponUsageSchema.index({ customerId: 1 });
studioCouponUsageSchema.index({ studioId: 1 });
studioCouponUsageSchema.index({ reservationId: 1 });

export const StudioCouponUsageModel: Model<IStudioCouponUsage> =
  mongoose.models.StudioCouponUsage || mongoose.model<IStudioCouponUsage>('StudioCouponUsage', studioCouponUsageSchema);

export default StudioCouponUsageModel;
