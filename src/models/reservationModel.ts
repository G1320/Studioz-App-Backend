import mongoose, { Model, Schema } from "mongoose";
import Reservation from "../types/reservation.js";

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
    status: { type: String, enum: ['pending', 'confirmed', 'expired'], default: 'pending' },
    expiration: { type: Date, required: true }, 
    itemPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: false },
    studioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Studio', required: true },
    costumerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    costumerName: { type: String, required: true },
    costumerPhone: { type: String, required: true },
    comment: { type: String, required: true },
    orderId: { type: String, required: false },
  });

  ReservationSchema.pre('save', function (next) {
    this.totalPrice = this.itemPrice * this.timeSlots.length;
    next();
  });
  
 const ReservationModel: Model<Reservation & Document> = mongoose.models.Reservation || mongoose.model<Reservation & Document>('Reservation', ReservationSchema);

  export { ReservationModel };
  