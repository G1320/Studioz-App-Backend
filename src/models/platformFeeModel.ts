import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const platformFeeSchema = new Schema({
  vendorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reservationId: {
    type: Schema.Types.ObjectId,
    ref: 'Reservation',
    required: false
  },
  studioId: {
    type: Schema.Types.ObjectId,
    ref: 'Studio',
    required: false
  },
  transactionType: {
    type: String,
    enum: ['reservation', 'quick_charge', 'multivendor'],
    required: true
  },
  transactionAmount: {
    type: Number,
    required: true
  },
  feePercentage: {
    type: Number,
    required: true
  },
  feeAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'billed', 'paid', 'credited', 'waived'],
    default: 'pending'
  },
  billingCycleId: {
    type: Schema.Types.ObjectId,
    ref: 'BillingCycle',
    required: false
  },
  // Reference to the original Sumit payment
  sumitPaymentId: {
    type: String,
    required: false
  },
  // Period in "YYYY-MM" format (matches usageModel convention)
  period: {
    type: String,
    required: true
  },
  creditedAt: { type: Date },
  creditReason: { type: String }
}, { timestamps: true });

platformFeeSchema.index({ vendorId: 1, period: 1 });
platformFeeSchema.index({ status: 1 });
platformFeeSchema.index({ billingCycleId: 1 });
platformFeeSchema.index({ reservationId: 1 }, { sparse: true });
platformFeeSchema.index({ vendorId: 1, status: 1 });

export const PlatformFeeModel = mongoose.model('PlatformFee', platformFeeSchema);
export default PlatformFeeModel;
