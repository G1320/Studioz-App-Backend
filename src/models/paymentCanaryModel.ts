import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentCanaryResult extends Document {
  testId: string;
  timestamp: Date;
  status: 'pass' | 'charge_failed';
  chargeAmount: number;
  currency: string;
  sumitPaymentId?: string;
  chargeLatencyMs: number;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
}

const paymentCanaryResultSchema = new Schema<IPaymentCanaryResult>({
  testId: { type: String, required: true, unique: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['pass', 'charge_failed'], required: true },
  chargeAmount: { type: Number, required: true },
  currency: { type: String, default: 'ILS' },
  sumitPaymentId: { type: String },
  chargeLatencyMs: { type: Number, required: true },
  errorMessage: { type: String },
  errorDetails: { type: Schema.Types.Mixed }
});

paymentCanaryResultSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const PaymentCanaryResultModel = mongoose.model<IPaymentCanaryResult>(
  'PaymentCanaryResult',
  paymentCanaryResultSchema
);

// --- Canary Config (persisted across restarts) ---

export interface IPaymentCanaryConfig extends Document {
  key: string;
  sumitCustomerId: string;
  customerEmail: string;
  customerName: string;
  lastFourDigits?: string;
  creditCardToken?: string;
  paymentMethodId?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  setupAt: Date;
}

const paymentCanaryConfigSchema = new Schema<IPaymentCanaryConfig>({
  key: { type: String, default: 'canary', unique: true },
  sumitCustomerId: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerName: { type: String, required: true },
  lastFourDigits: { type: String },
  creditCardToken: { type: String },
  paymentMethodId: { type: String },
  cardExpMonth: { type: Number },
  cardExpYear: { type: Number },
  setupAt: { type: Date, default: Date.now }
});

export const PaymentCanaryConfigModel = mongoose.model<IPaymentCanaryConfig>(
  'PaymentCanaryConfig',
  paymentCanaryConfigSchema
);
