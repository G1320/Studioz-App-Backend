
import { Types } from 'mongoose';
import WishlistItem from './wishlistItem.js';

export default interface Wishlist {
  _id?: Types.ObjectId;
  name: string;
  studios: Types.ObjectId[];
  createdBy: Types.ObjectId;
  items: WishlistItem[];
  createdAt?: Date;
  updatedAt?: Date;
}
