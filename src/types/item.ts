import Availability from './availability.js';

export default interface Item {
  _id: string;
  studio: string;
  name: string;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  category?: string;
  categories?: string[];
  subCategory?: string;
  subCategories?: string[];
  price?: number;
  imageUrl?: string;
  idx?: number;
  inStock: boolean;
  studioId: string;
  studioName: string;
  studioImgUrl?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  paypalMerchantId?: string;

  availability?: Availability[];
}
