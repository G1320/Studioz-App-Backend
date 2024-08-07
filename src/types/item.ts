import { Types } from 'mongoose';

export default interface Item {
  _id?: Types.ObjectId;
  itemId: Types.ObjectId;
  studio: Types.ObjectId;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  price?: number;
  imgUrl?: string;
  idx?: number;
  inStock: boolean;
  studioId: Types.ObjectId;
  studioName: string;
  createdAt?: Date;
  updatedAt?: Date;
}
