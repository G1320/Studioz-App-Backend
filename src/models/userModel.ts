import mongoose, { Document, Schema, Model } from 'mongoose';
import { User } from '../types/index.js';

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
    cart: [{ type: Schema.Types.ObjectId, ref: 'Item' }],
  },
  { timestamps: true }
);

const UserModel: Model<User & Document> = mongoose.models.User || mongoose.model<User & Document>('User', userSchema);

export { UserModel };
