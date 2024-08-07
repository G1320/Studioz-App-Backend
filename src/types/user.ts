import { Types } from 'mongoose';

export default interface User {
  _id: Types.ObjectId;
  username: string;
  firstName?: string;
  lastName?: string;
  name: string;
  avatar?: string;
  password?: string; 
  picture?: string;
  sub: string;
  updatedAt?: Date;
  email?: string;
  studios?: Types.ObjectId[];
  wishlists?: Types.ObjectId[];
  cart?: Types.ObjectId[];
  __v?: number;
}
