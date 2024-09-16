import mongoose, { Document, Schema, Model } from 'mongoose';
import { Item } from '../types/index.js';

const itemSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: false },
  category: { type: String, required: false },
  subcategory: { type: String, required: false },
  price: { type: Number, required: false },
  imgUrl: { type: String, required: false },
  idx: { type: Number, required: false },
  inStock: { type: Boolean, required: true },
  studioId: { type: Schema.Types.ObjectId, ref: 'Studio' },
  studioName: { type: String, required: true },
  studioImgUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const ItemModel: Model<Item & Document> = mongoose.models.Item || mongoose.model<Item & Document>('Item', itemSchema);

export { ItemModel };