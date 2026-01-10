import mongoose, { Document, Schema, Model } from 'mongoose';
import { Studio } from '../types/index.js';

const StudioAvailability = new mongoose.Schema({
  days: [{
    type: String,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: true
  }],
  times: [{ 
    start: String,
    end: String 
  }]
});

const translationSchema = new Schema({
  en: { type: String, required: false },
  he: { type: String, required: false }
}, { _id: false });

const socialsSchema = new Schema({
  instagram: { type: String, required: false },
  facebook: { type: String, required: false }
}, { _id: false });

const cancellationPolicySchema = new Schema({
  type: {
    type: String,
    enum: ['flexible', 'moderate', 'strict'],
    required: false
  },
  houseRules: {
    en: { type: String, required: false },
    he: { type: String, required: false }
  }
}, { _id: false });

const equipmentCategorySchema = new Schema({
  category: { type: String, required: true },
  items: { type: String, required: false } // Raw text input - items separated by newlines or commas
}, { _id: false });

const portfolioItemSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  artist: { type: String, required: true },
  type: { type: String, enum: ['audio', 'video', 'album'], required: true },
  coverUrl: { type: String, required: false },
  link: { type: String, required: true },
  role: { type: String, required: false }
}, { _id: false });

const socialLinksSchema = new Schema({
  spotify: { type: String, required: false },
  soundcloud: { type: String, required: false },
  appleMusic: { type: String, required: false },
  youtube: { type: String, required: false },
  instagram: { type: String, required: false },
  website: { type: String, required: false }
}, { _id: false });

const studioSchema = new Schema({
  name: { type: translationSchema, required: false },
  subtitle: { type: translationSchema, required: false },
  description: { type: translationSchema, required: false },
  phone: { type: String, required: false },
  website: { type: String, required: false },
  socials: { type: socialsSchema, required: false },
  categories: [{ type: String, required: false }],
  subCategories: [{ type: String, required: false }],
  genres: [{ type: String, required: false }],
  amenities: [{ type: String, required: false }],
  equipment: [{ type: equipmentCategorySchema, required: false }],
  maxOccupancy: { type: Number, required: false },
  size: { type: Number, required: false }, // Square meters
  averageRating: { type: Number, required: false, default: 0 },
  reviewCount: { type: Number, required: false, default: 0 },
  totalBookings: { type: Number, required: false, default: 0 },
  city: { type: String, required: false },
  address: { type: String, required: false },
  lat: { type: Number, required: false },
  lng: { type: Number, required: false },
  coverImage: { type: String, required: false },
  galleryImages: [{ type: String, required: false }],
  galleryAudioFiles: [{ type: String, required: false }],
  coverAudioFile: { type: String, required: false },
  isSmokingAllowed: { type: Boolean, required: false },
  isWheelchairAccessible: { type: Boolean, required: false },
  isSelfService: { type: Boolean, required: false },
  isFeatured: { type: Boolean, required: false },
  paymentEnabled: { type: Boolean, required: false, default: false },
  parking: {
    type: String,
    enum: ['private', 'street', 'paid', 'none'],
    required: false,
    default: 'none'
  },
  arrivalInstructions: { type: String, required: false },
  cancellationPolicy: { type: cancellationPolicySchema, required: false },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  studioAvailability: { type: StudioAvailability, required: false },
  portfolio: [{ type: portfolioItemSchema, required: false }],
  socialLinks: { type: socialLinksSchema, required: false },
  items: [
    {
      idx: { type: Number, required: true },
      name: { type: translationSchema, required: false },
      nameEn: { type: String, required: false },
      nameHe: { type: String, required: false },
      itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
      studioId: { type: Schema.Types.ObjectId, ref: 'Studio' },
      studioImgUrl: { type: String, required: false },
      address: { type: String, required: false },
      lat: { type: Number, required: false },
      lng: { type: Number, required: false },
      sellerId: { type: Schema.Types.ObjectId, ref: 'User' },
    }
  ]
});

studioSchema.index({ location: '2dsphere' });

const StudioModel: Model<Studio & Document> =
  mongoose.models.Studio || mongoose.model<Studio & Document>('Studio', studioSchema);

export { StudioModel };
