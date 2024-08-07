import { Types } from 'mongoose';

export default interface WishlistItem {
  idx: number;
  itemId: Types.ObjectId;
}
