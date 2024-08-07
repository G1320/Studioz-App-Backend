import mongoose, { Document, Schema, Model } from 'mongoose';
import { Wishlist } from '../types/index.js';

const wishlistSchema = new Schema(
  {
    name: { type: String, required: true },
    studios: [{ type: Schema.Types.ObjectId, ref: 'Studio' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    items: [
      {
        idx: { type: Number, required: true },
        itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
      },
    ],
  },
  { timestamps: true }
);

const WishlistModel: Model<Wishlist & Document> = mongoose.models.Wishlist || mongoose.model<Wishlist & Document>('Wishlist', wishlistSchema);

export { WishlistModel };
