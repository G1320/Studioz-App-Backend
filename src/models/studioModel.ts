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

const studioSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  categories: [{ type: String, required: false }],
  subCategories: [{ type: String, required: false }],
  maxOccupancy: { type: Number, required: false },
  city: { type: String, required: true },
  address: { type: String, required: false },
  coverImage: { type: String, required: false },
  galleryImages: [{ type: String, required: false }],
  galleryAudioFiles: [{ type: String, required: false }],
  coverAudioFile: { type: String, required: false },
  isSmokingAllowed: { type: Boolean, required: false },
  isWheelchairAccessible: { type: Boolean, required: false },
  isSelfService: { type: Boolean, required: false },
  isFeatured: { type: Boolean, required: false },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  studioAvailability: { type: StudioAvailability, required: false },
  location: {
    type: { type: String, enum: ['Point'], required: false },
    coordinates: { type: [Number], required: false }
  },
  items: [
    {
      idx: { type: Number, required: true },
      itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
      studioId: { type: Schema.Types.ObjectId, ref: 'Studio' },
      studioImgUrl: { type: String, required: false }
    }
  ]
});

studioSchema.index({ location: '2dsphere' });

const StudioModel: Model<Studio & Document> =
  mongoose.models.Studio || mongoose.model<Studio & Document>('Studio', studioSchema);

export { StudioModel };
