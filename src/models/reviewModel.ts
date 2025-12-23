import mongoose, { Document, Schema, Model } from 'mongoose';
import { Review } from '../types/index.js';

const translationSchema = new Schema({
  en: { type: String, required: false },
  he: { type: String, required: false }
}, { _id: false });

const reviewSchema = new Schema(
  {
    studioId: { type: Schema.Types.ObjectId, ref: 'Studio', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    name: { type: translationSchema, required: false },
    comment: { type: translationSchema, required: false },
    isVerified: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true }
  },
  { timestamps: true }
);

reviewSchema.index({ studioId: 1, userId: 1 }, { unique: true });

const ReviewModel: Model<Review & Document> =
  mongoose.models.Review || mongoose.model<Review & Document>('Review', reviewSchema);

export { ReviewModel };

