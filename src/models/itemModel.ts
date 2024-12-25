import mongoose, { Document, Schema, Model } from 'mongoose';
import { Item } from '../types/index.js';

const availabilitySchema: Schema = new Schema({
  date: { type: String, required: true },
  times: { type: [String], required: true }
});

const itemSchema: Schema = new Schema({
  name: { type: String, required: false },
  nameEn: { type: String, required: false },
  nameHe: { type: String, required: false },
  description: { type: String, required: false },
  descriptionEn: { type: String, required: false },
  descriptionHe: { type: String, required: false },
  category: { type: String, required: false },
  categories: [{ type: String, required: false }],
  subCategory: { type: String, required: false },
  subCategories: [{ type: String, required: false }],
  price: { type: Number, required: false },
  pricePer: { type: String, required: false },
  imgUrl: { type: String, required: false },
  idx: { type: Number, required: false },
  inStock: { type: Boolean, required: false },
  studioId: { type: Schema.Types.ObjectId, ref: 'Studio' },
  studioNameEn: { type: String, required: false },
  studioNameHe: { type: String, required: false },
  studioImgUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  address: { type: String, required: false },
      lat: { type: Number, required: false },
      lng: { type: Number, required: false },
 sellerId: { type: Schema.Types.ObjectId, ref: 'User' },
  availability: { type: [availabilitySchema], required: false }
});

const ItemModel: Model<Item & Document> = mongoose.models.Item || mongoose.model<Item & Document>('Item', itemSchema);

export { ItemModel };
