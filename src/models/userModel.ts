import mongoose, { Document, Schema, Model } from 'mongoose';
import { User } from '../types/index.js';

const cartItemSchema = new Schema({
  name: {
    en: { type: String, required: true },
    he: { type: String, required: false },
  },
  studioName: {
    en: { type: String, required: false },
    he: { type: String, required: false },
  },
  price: { type: Number, required: false },
  total: { type: Number, required: false },
  itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: false },
  quantity: { type: Number, required: false, default: 1 },
  bookingDate: { type: String, required: false },
  startTime: { type: String, required: false },
  studioId: { type: Schema.Types.ObjectId, ref: 'Studio', required: false },
  reservationId: { type: Schema.Types.ObjectId, ref: 'Reservation', required: false },
});

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    firstName: { type: String },
    lastName: { type: String },
    name: { type: String, required: true },
    avatar: { type: String },
    phone: { type: String },
    password: { type: String, select: false },
    picture: { type: String },
    email: { type: String, required: false, unique: true },
    email_verified: { type: Boolean, default: false },
    sub: { type: String, required: true, unique: true },
    updatedAt: { type: Date, default: Date.now },
    isAdmin: { type: Boolean, default: false },
    studios: [{ type: Schema.Types.ObjectId, ref: 'Studio' }],
    wishlists: [{ type: Schema.Types.ObjectId, ref: 'Wishlist' }],
    reservations: [{ type: Schema.Types.ObjectId, ref: 'reservation' }],
    cart: {
      items: [cartItemSchema]
    },
    paypalMerchantId: { 
      type: String,
      sparse: true 
    },
    paypalOnboardingStatus: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'PENDING'
    },
    paypalAccountStatus: {
      payments_receivable: Boolean,
      primary_email_confirmed: Boolean,
      oauth_integrations: [{
        status: String,
        integration_type: String
      }],
    },
    sumitCompanyId: { type: Number },
  sumitApiKey: { type: String },
  sumitApiPublicKey: { type: String },
  // Customer's saved card info (for paying, not receiving)
  sumitCustomerId: { type: String },
  savedCardLastFour: { type: String },
  savedCardBrand: { type: String },
  role: { 
    type: String,
    enum: ['user', 'vendor', 'admin'],
    default: 'user'
  },
    subscriptionStatus: { type: String },
    subscriptionId: { type: String },
    googleCalendar: {
      connected: { type: Boolean, default: false },
      accessToken: { type: String, select: false },
      refreshToken: { type: String, select: false },
      tokenExpiry: { type: Date },
      calendarId: { type: String, default: 'primary' },
      lastSyncAt: { type: Date },
      syncToken: { type: String }
    },
    // Email notification preferences
    emailPreferences: {
      // Master toggle - if false, no emails are sent
      enabled: { type: Boolean, default: true },
      // Granular preferences (only checked if enabled is true)
      bookingConfirmations: { type: Boolean, default: true },
      bookingReminders: { type: Boolean, default: true },
      bookingCancellations: { type: Boolean, default: true },
      paymentReceipts: { type: Boolean, default: true },
      payoutNotifications: { type: Boolean, default: true },
      subscriptionUpdates: { type: Boolean, default: true },
      promotionalEmails: { type: Boolean, default: true },
      reviewRequests: { type: Boolean, default: true }
    }
  },

  { timestamps: true }
);

const UserModel: Model<User & Document> = mongoose.models.User || mongoose.model<User & Document>('User', userSchema);

export { UserModel };
