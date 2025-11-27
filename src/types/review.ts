import type User from './user.js';

export type ReviewUser = Pick<User, 'name' | 'firstName' | 'lastName' | 'avatar'> & { _id: string };

export default interface Review {
  _id: string;
  studioId: string;
  userId: string;
  rating: number;
  comment?: string;
  isVerified?: boolean;
  isVisible?: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: ReviewUser;
}

