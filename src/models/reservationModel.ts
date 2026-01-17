import mongoose, { Model, Schema, Document } from "mongoose";
import Reservation from "../types/reservation.js";
import { calculateReservationTotalPrice } from "../utils/reservationPriceUtils.js";

const translationSchema = new Schema({
  en: { type: String, required: false },
  he: { type: String, required: false }
}, { _id: false });

// Payment details schema (optional - only when vendor accepts payments)
const paymentDetailsSchema = new mongoose.Schema({
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
  refundedAt: { type: Date }
}, { _id: false });

const ReservationSchema = new mongoose.Schema({
  
    itemName: { type: translationSchema, required: false },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    bookingDate: { type: String, required: true },
    timeSlots: [{ type: String, required: true }],
    status: { type: String, enum: ['pending', 'confirmed', 'expired', 'cancelled', 'rejected', 'payment_failed'], default: 'pending' },
    expiration: { type: Date, required: true }, 
    itemPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: false },
    studioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Studio', required: true },
    studioName: { type: translationSchema, required: false },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    customerName: { type: String, required: false },
    customerPhone: { type: String, required: false },
    comment: { type: String, required: false },
    orderId: { type: String, required: false },
    addOnIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AddOn', required: false }],
    googleCalendarEventId: { type: String, required: false },
    address: { type: String, required: false },
    studioImgUrl: { type: String, required: false },
    quantity: { type: Number, required: false, default: 1 },
    // Payment fields (optional - only populated when vendor accepts payments)
    paymentStatus: {
      type: String,
      enum: ['pending', 'card_saved', 'charged', 'failed', 'refunded'],
      required: false
    },
    paymentDetails: { type: paymentDetailsSchema, required: false },
    // Coupon fields (optional - only populated when a studio coupon is applied)
    couponCode: { type: String, required: false },
    couponDiscount: { type: Number, required: false, default: 0 },
    priceBeforeDiscount: { type: Number, required: false },
  }, { timestamps: true });

  // Database indexes for query performance
  ReservationSchema.index({ status: 1 });
  ReservationSchema.index({ itemId: 1, bookingDate: 1 });
  ReservationSchema.index({ studioId: 1 });
  ReservationSchema.index({ customerId: 1 });
  ReservationSchema.index({ userId: 1 });
  ReservationSchema.index({ orderId: 1 });
  ReservationSchema.index({ expiration: 1 });
  ReservationSchema.index({ createdAt: -1 });

  // Pre-save hook to ensure totalPrice is calculated
  // Note: This won't run for findOneAndUpdate/findByIdAndUpdate operations
  // Handlers using those methods should mark price-affecting fields as modified, then call .save()
  ReservationSchema.pre('save', async function (next) {
    const priceFieldsModified = 
      this.isModified('addOnIds') ||
      this.isModified('timeSlots') ||
      this.isModified('itemPrice');
    
    if (this.isNew || !this.totalPrice || priceFieldsModified) {
      const addOnIdsAsStrings = this.addOnIds?.map(id => id.toString()) || [];
      this.totalPrice = await calculateReservationTotalPrice(
        this.itemPrice || 0,
        this.timeSlots || [],
        addOnIdsAsStrings
      );
    }
    next();
  });
  
 const ReservationModel: Model<Reservation & Document> = mongoose.models.Reservation || mongoose.model<Reservation & Document>('Reservation', ReservationSchema);

  export { ReservationModel };
  