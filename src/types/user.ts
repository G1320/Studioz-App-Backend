import { Cart, Wishlist } from './index.js';
import Reservation from './reservation.js';

export type PayPalOnboardingStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface PayPalOAuthIntegration {
  status: string;
  integration_type: string;
}

export interface PayPalAccountStatus {
  payments_receivable?: boolean;
  primary_email_confirmed?: boolean;
  oauth_integrations?: PayPalOAuthIntegration[];
}

export default interface User {
  _id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  name: string;
  avatar?: string;
  password?: string;
  picture?: string;
  phone?: string;
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
  paypalAccountStatus?: PayPalAccountStatus;

  __v?: number;
}
