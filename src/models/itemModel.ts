import mongoose, { Document, Schema, Model } from 'mongoose';
import { Item } from '../types/index.js';

const availabilitySchema: Schema = new Schema({
  date: { type: String, required: false },
  times: { type: [String], required: false }
});

const translationSchema = new Schema({
  en: { type: String, required: false },
  he: { type: String, required: false }
}, { _id: false });

const durationSchema = new Schema({
  value: { type: Number, required: false },
  unit: { 
    type: String, 
    enum: ['minutes', 'hours', 'days'],
    required: false 
  }
}, { _id: false });

const advanceBookingSchema = new Schema({
  value: { type: Number, required: false },
  unit: { 
    type: String, 
    enum: ['hours', 'days'],
    required: false 
  }
}, { _id: false });

const cancellationPolicySchema = new Schema({
  type: {
    type: String,
    enum: ['flexible', 'moderate', 'strict'],
    required: false
  },
  notes: {
    en: { type: String, required: false },
    he: { type: String, required: false }
  }
}, { _id: false });

const blockDiscountsSchema = new Schema({
  eightHour: { type: Number, required: false },
  twelveHour: { type: Number, required: false }
}, { _id: false });

const itemSchema: Schema = new Schema({
  studioId: { type: Schema.Types.ObjectId, ref: 'Studio' },
  sellerId: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: translationSchema, required: false },
  subtitle: { type: translationSchema, required: false },
  description: { type: translationSchema, required: false },
  studioName: { type: translationSchema, required: false },
  categories: [{ type: String, required: false }],
  subCategory: { type: String, required: false },
  subCategories: [{ type: String, required: false }],
  genres: [{ type: String, required: false }],
  price: { type: Number, required: false },
  pricePer: { type: String, required: false },
  blockDiscounts: { type: blockDiscountsSchema, required: false },
  imgUrl: { type: String, required: false },
  idx: { type: Number, required: false },
  inStock: { type: Boolean, required: false },
  
  studioImgUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  address: { type: String, required: false },
  city: { type: String, required: false },
      lat: { type: Number, required: false },
      lng: { type: Number, required: false },
  availability: { type: [availabilitySchema], required: false },
  instantBook: { type: Boolean, required: false, default: false },
  addOnIds: [{ type: Schema.Types.ObjectId, ref: 'AddOn' }],
  
  // Booking Requirements
  minimumBookingDuration: { type: durationSchema, required: false },
  minimumQuantity: { type: Number, required: false },
  advanceBookingRequired: { type: advanceBookingSchema, required: false },
  
  // Setup & Preparation
  preparationTime: { type: durationSchema, required: false },
  
  // Policies
  cancellationPolicy: { type: cancellationPolicySchema, required: false },
  
  // Remote Service
  remoteService: { type: Boolean, required: false, default: false },
  remoteAccessMethod: {
    type: String,
    enum: ['zoom', 'teams', 'skype', 'custom', 'other'],
    required: false
  },
  softwareRequirements: [{ type: String, required: false }],
  
  // Quantity Management
  maxQuantityPerBooking: { type: Number, required: false }
});

const ItemModel: Model<Item & Document> = mongoose.models.Item || mongoose.model<Item & Document>('Item', itemSchema);

export { ItemModel };
