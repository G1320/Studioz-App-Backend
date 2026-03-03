import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const billingCycleSchema = new Schema({
  vendorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  period: {
    type: String,
    required: true
  },
  totalTransactionAmount: {
    type: Number,
    required: true
  },
  totalFeeAmount: {
    type: Number,
    required: true
  },
  feeCount: {
    type: Number,
    required: true
  },
  feePercentage: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed'],
    default: 'pending'
  },
  // Vendor's Sumit customer ID (from their subscription card)
  sumitCustomerId: { type: String },
  // Platform's charge payment ID
  sumitPaymentId: { type: String },
  chargedAt: { type: Date },
  failureReason: { type: String },
  retryCount: {
    type: Number,
    default: 0
  },
  nextRetryAt: { type: Date },
  // Sumit document ID for the platform fee invoice
  invoiceDocumentId: { type: String },
  invoiceDocumentUrl: { type: String }
}, { timestamps: true });

billingCycleSchema.index({ vendorId: 1, period: 1 }, { unique: true });
billingCycleSchema.index({ status: 1 });
billingCycleSchema.index({ status: 1, nextRetryAt: 1 });

export const BillingCycleModel = mongoose.model('BillingCycle', billingCycleSchema);
export default BillingCycleModel;
