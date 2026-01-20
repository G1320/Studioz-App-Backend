import mongoose from 'mongoose';

const Schema = mongoose.Schema;

/**
 * Usage Model
 * Tracks monthly usage per vendor for subscription limit enforcement
 */
const usageSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Format: "2026-01" for January 2026
  month: {
    type: String,
    required: true
  },
  // Number of payments processed this month
  paymentsProcessed: {
    type: Number,
    default: 0
  },
  // Total sum of all payment amounts this month
  paymentsTotal: {
    type: Number,
    default: 0
  },
  // Number of listings created this month (for tracking, not limiting)
  listingsCreated: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries - one record per user per month
usageSchema.index({ userId: 1, month: 1 }, { unique: true });

// Index for cleanup of old records
usageSchema.index({ month: 1 });

export const UsageModel = mongoose.model('Usage', usageSchema);
export default UsageModel;
