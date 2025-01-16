import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const subscriptionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planId: {
    type: String,
    required: true
  },
  paypalSubscriptionId: {
    type: String
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'CANCELLED', 'SUSPENDED', 'PAYMENT_FAILED'],
    default: 'PENDING'
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  planName: {
    type: String
  },
    customerName: {
        type: String
    },
    customerEmail: {
        type: String
    },
  paypalDetails: mongoose.Schema.Types.Mixed,
});

subscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const SubscriptionModel = mongoose.model('Subscription', subscriptionSchema);
export default SubscriptionModel;