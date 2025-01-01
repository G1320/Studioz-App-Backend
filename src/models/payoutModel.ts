import mongoose, { Model, Schema } from "mongoose";
import Payout from "../types/payout.js";

const payoutSchema = new Schema({
    sellerId: { type: String, required: true },
    amount: { type: Number, required: true },
    orderId: { type: String, required: true },
    payoutId: { type: String, required: true },
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    invoiceId: { type: String, required: true }
  });

   const PayoutModel: Model<Payout & Document> =
  mongoose.models.Payout || mongoose.model<Payout & Document>('Payout', payoutSchema);

  export { PayoutModel };
