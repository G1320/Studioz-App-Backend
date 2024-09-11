import Wishlist from "./wishlist.js";
export default interface User {
  _id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  name: string;
  avatar?: string;
  password?: string; 
  picture?: string;
  sub: string;
  isAdmin?: boolean;
  updatedAt?: Date;
  email?: string;
  studios?: string[];
  wishlists?:  Wishlist[];
  cart?: string[];
  __v?: number;
}
