import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentCanaryResult extends Document {
  testId: string;
  timestamp: Date;
  status: 'pass' | 'charge_failed' | 'refund_failed';
  chargeAmount: number;
  currency: string;
  sumitPaymentId?: string;
  refundId?: string;
  chargeLatencyMs: number;
  refundLatencyMs?: number;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
}

const paymentCanaryResultSchema = new Schema<IPaymentCanaryResult>({
  testId: { type: String, required: true, unique: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['pass', 'charge_failed', 'refund_failed'], required: true },
  chargeAmount: { type: Number, required: true },
  currency: { type: String, default: 'ILS' },
  sumitPaymentId: { type: String },
  refundId: { type: String },
  chargeLatencyMs: { type: Number, required: true },
  refundLatencyMs: { type: Number },
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
  lastFourDigits?: string;
  setupAt: Date;
}

const paymentCanaryConfigSchema = new Schema<IPaymentCanaryConfig>({
  key: { type: String, default: 'canary', unique: true },
  sumitCustomerId: { type: String, required: true },
  lastFourDigits: { type: String },
  setupAt: { type: Date, default: Date.now }
});

export const PaymentCanaryConfigModel = mongoose.model<IPaymentCanaryConfig>(
  'PaymentCanaryConfig',
  paymentCanaryConfigSchema
);
