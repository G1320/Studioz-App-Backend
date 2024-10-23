import mongoose, { Document, Schema, Model } from 'mongoose';
import { User } from '../types/index.js';

const cartItemSchema = new Schema({
  name: { type: String, required: false },
  price: { type: Number, required: false },
  total: { type: Number, required: false },
  itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: false },
  quantity: { type: Number, required: false, default: 1 },
  bookingDate: { type: String, required: false },
  startTime: { type: String, required: false },
  studioName: { type: String, required: false },
  studioId: { type: Schema.Types.ObjectId, ref: 'Studio', required: false }
});

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    firstName: { type: String },
    lastName: { type: String },
    name: { type: String, required: true },
    avatar: { type: String },
    password: { type: String, select: false },
    picture: { type: String },
    sub: { type: String, required: true, unique: true },
    updatedAt: { type: Date, default: Date.now },
    isAdmin: { type: Boolean, default: false },
    studios: [{ type: Schema.Types.ObjectId, ref: 'Studio' }],
    wishlists: [{ type: Schema.Types.ObjectId, ref: 'Wishlist' }],
    cart: {
      items: [cartItemSchema]
    }
  },
  { timestamps: true }
);

const UserModel: Model<User & Document> = mongoose.models.User || mongoose.model<User & Document>('User', userSchema);

export { UserModel };
