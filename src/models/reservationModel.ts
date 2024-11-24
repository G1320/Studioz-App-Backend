import mongoose, { Model } from "mongoose";
import Reservation from "../types/reservation.js";

const ReservationSchema = new mongoose.Schema({
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    bookingDate: { type: String, required: true },
    timeSlots: [{ type: String, required: true }],
    status: { type: String, enum: ['pending', 'confirmed', 'expired'], default: 'pending' },
    expiration: { type: Date, required: true }, // Timestamp for reservation expiration
  });
  
 const ReservationModel: Model<Reservation & Document> = mongoose.models.Reservation || mongoose.model<Reservation & Document>('Reservation', ReservationSchema);

  export { ReservationModel };
  