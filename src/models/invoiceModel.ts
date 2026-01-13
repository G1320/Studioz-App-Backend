import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoice extends Document {
  externalId: string;
  provider: 'GREEN_INVOICE' | 'SUMIT';
  documentType: string;
  amount: number;
  currency: string;
  issuedDate: Date;
  customerName?: string;
  customerEmail?: string;
  documentUrl?: string;
  relatedEntity?: {
    type: 'ORDER' | 'SUBSCRIPTION' | 'RESERVATION' | 'PAYOUT';
    id: mongoose.Types.ObjectId;
  };
  status?: string;
  rawData?: any;
}

const invoiceSchema = new Schema<IInvoice>({
  externalId: { type: String, required: true, index: true },
  provider: { type: String, enum: ['GREEN_INVOICE', 'SUMIT'], required: true },
  documentType: { type: String, default: 'invoice' },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  issuedDate: { type: Date, default: Date.now },
  customerName: { type: String },
  customerEmail: { type: String },
  documentUrl: { type: String },
  relatedEntity: {
    type: { type: String, enum: ['ORDER', 'SUBSCRIPTION', 'RESERVATION', 'PAYOUT'] },
    id: { type: Schema.Types.ObjectId }
  },
  status: { type: String },
  rawData: { type: Schema.Types.Mixed }
}, { timestamps: true });

export const InvoiceModel = mongoose.model<IInvoice>('Invoice', invoiceSchema);
