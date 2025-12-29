import mongoose, { Model, Schema, Document } from "mongoose";
import Reservation from "../types/reservation.js";
import { calculateReservationTotalPrice } from "../utils/reservationPriceUtils.js";

const translationSchema = new Schema({
  en: { type: String, required: false },
  he: { type: String, required: false }
}, { _id: false });

const ReservationSchema = new mongoose.Schema({
  
    itemName: { type: translationSchema, required: false },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    bookingDate: { type: String, required: true },
    timeSlots: [{ type: String, required: true }],
    status: { type: String, enum: ['pending', 'confirmed', 'expired', 'cancelled', 'rejected'], default: 'pending' },
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
  }, { timestamps: true });

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
  