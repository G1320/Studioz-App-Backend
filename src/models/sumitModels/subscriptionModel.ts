import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const sumitPaymentMethodSchema = new Schema({
  ID: String,
  CustomerID: String,
  CreditCard_LastDigits: String,
  CreditCard_ExpirationMonth: Number,
  CreditCard_ExpirationYear: Number,
  CreditCard_CitizenID: String,
  CreditCard_CardMask: String,
  CreditCard_Token: String,
  Type: Number
}, { _id: false });

const sumitPaymentDetailsSchema = new Schema({
  ID: String,
  CustomerID: String,
  Date: Date,
  ValidPayment: Boolean,
  Status: String,
  StatusDescription: String,
  Amount: Number,
  Currency: Number,
  PaymentMethod: sumitPaymentMethodSchema,
  AuthNumber: String,
  FirstPaymentAmount: Number,
  NonFirstPaymentAmount: Number,
  RecurringCustomerItemIDs: [String]
}, { _id: false });

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
  sumitPaymentId: {
    type: String
  },
  sumitCustomerId: {
    type: String
  },
  sumitRecurringItemIds: {
    type: [String]
  },
  sumitPaymentDetails: {
    type: sumitPaymentDetailsSchema
  },
  // Keep paypalDetails for backward compatibility if needed
  paypalDetails: mongoose.Schema.Types.Mixed
});

subscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});


export const SubscriptionModel = mongoose.model('Subscription', subscriptionSchema);
export default SubscriptionModel;