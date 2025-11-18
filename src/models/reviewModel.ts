import mongoose, { Document, Schema, Model } from 'mongoose';
import { Review } from '../types/index.js';

const reviewSchema = new Schema(
  {
    studioId: { type: Schema.Types.ObjectId, ref: 'Studio', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: false, maxlength: 1000 },
    isVerified: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true }
  },
  { timestamps: true }
);

reviewSchema.index({ studioId: 1, userId: 1 }, { unique: true });

const ReviewModel: Model<Review & Document> =
  mongoose.models.Review || mongoose.model<Review & Document>('Review', reviewSchema);

export { ReviewModel };

