
import WishlistItem from './wishlistItem.js';

export default interface Wishlist {
  _id: string
  name: string;
  description: string;
  studios: string[];
  createdBy: string;
  items: WishlistItem[];
  createdAt?: Date;
  updatedAt?: Date;
}