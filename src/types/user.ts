import { Cart, Wishlist } from './index.js';
import Reservation from './reservation.js';

export type PayPalOnboardingStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

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
  email_verified?: boolean;
  studios?: string[];
  wishlists?: Wishlist[];
  reservations?: Reservation[];
  cart?: Cart;
  paypalMerchantId?: string;
  paypalOnboardingStatus?: PayPalOnboardingStatus;
  __v?: number;
}
