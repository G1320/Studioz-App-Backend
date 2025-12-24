import mongoose, { Document, Schema, Model } from 'mongoose';
import { Item } from '../types/index.js';

const availabilitySchema: Schema = new Schema({
  date: { type: String, required: true },
  times: { type: [String], required: true }
});

const translationSchema = new Schema({
  en: { type: String, required: true },
  he: { type: String, required: true }
}, { _id: false });

const durationSchema = new Schema({
  value: { type: Number, required: true },
  unit: { 
    type: String, 
    enum: ['minutes', 'hours', 'days'],
    required: true 
  }
}, { _id: false });

const advanceBookingSchema = new Schema({
  value: { type: Number, required: true },
  unit: { 
    type: String, 
    enum: ['hours', 'days'],
    required: true 
  }
}, { _id: false });

const cancellationPolicySchema = new Schema({
  type: {
    type: String,
    enum: ['flexible', 'moderate', 'strict'],
    required: true
  },
  notes: {
    en: { type: String, required: false },
    he: { type: String, required: false }
  }
}, { _id: false });

const itemSchema: Schema = new Schema({
  studioId: { type: Schema.Types.ObjectId, ref: 'Studio' },
  sellerId: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: translationSchema, required: true },
  subtitle: { type: translationSchema, required: true },
  description: { type: translationSchema, required: true },
  studioName: { type: translationSchema, required: true },
  categories: [{ type: String, required: true }],
  subCategory: { type: String, required: true },
  subCategories: [{ type: String, required: true }],
  genres: [{ type: String, required: true }],
  price: { type: Number, required: true },
  pricePer: { type: String, required: true },
  imgUrl: { type: String, required: true },
  idx: { type: Number, required: true },
  inStock: { type: Boolean, required: true },
  
  studioImgUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  address: { type: String, required: true },
  city: { type: String, required: true },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
  availability: { type: [availabilitySchema], required: true },
  instantBook: { type: Boolean, required: true, default: false },
  addOnIds: [{ type: Schema.Types.ObjectId, ref: 'AddOn' }],
  
  // Booking Requirements
  minimumBookingDuration: { type: durationSchema, required: false },
  minimumQuantity: { type: Number, required: false },
  maximumBookingDuration: { type: durationSchema, required: false },
  advanceBookingRequired: { type: advanceBookingSchema, required: false },
  
  // Setup & Preparation
  preparationTime: { type: durationSchema, required: false },
  bufferTime: { type: durationSchema, required: false },
  
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
  maxQuantityPerBooking: { type: Number, required: false },
  
  // Same-Day Booking
  allowSameDayBooking: { type: Boolean, required: false, default: false }
});

const ItemModel: Model<Item & Document> = mongoose.models.Item || mongoose.model<Item & Document>('Item', itemSchema);

export { ItemModel };
