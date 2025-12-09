import mongoose, { Document, Schema, Model } from 'mongoose';
import { AddOn } from '../types/index.js';

const translationSchema = new Schema({
  en: { type: String, required: false },
  he: { type: String, required: false }
}, { _id: false });

const addOnSchema: Schema = new Schema({
  name: { type: translationSchema, required: true },
  description: { type: translationSchema, required: false },
  price: { type: Number, required: true },
  pricePer: { type: String, required: false },
  itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: false },
  isActive: { type: Boolean, required: false, default: true },
  idx: { type: Number, required: false },
  imageUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const AddOnModel: Model<AddOn & Document> = mongoose.models.AddOn || mongoose.model<AddOn & Document>('AddOn', addOnSchema);

export { AddOnModel };

