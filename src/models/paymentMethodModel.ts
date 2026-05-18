import mongoose, { Document, Schema, Model } from 'mongoose';

export interface PaymentMethodDoc extends Document {
  userId: mongoose.Types.ObjectId;
  sumitCustomerId: string;
  cardToken: string;
  lastFour: string;
  brand: string;
  expirationMonth?: number;
  expirationYear?: number;
  cardMask?: string;
  isDefault: boolean;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentMethodSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sumitCustomerId: { type: String, required: true },
    cardToken: { type: String, default: '' },
    lastFour: { type: String, required: true },
    brand: { type: String, default: 'visa' },
    expirationMonth: { type: Number },
    expirationYear: { type: Number },
    cardMask: { type: String },
    isDefault: { type: Boolean, default: false },
    label: { type: String },
  },
  { timestamps: true }
);

paymentMethodSchema.index({ userId: 1, isDefault: 1 });

const PaymentMethodModel: Model<PaymentMethodDoc> =
  mongoose.models.PaymentMethod ||
  mongoose.model<PaymentMethodDoc>('PaymentMethod', paymentMethodSchema);

export { PaymentMethodModel };
