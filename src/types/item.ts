import Availability from './availability.js';

export default interface Item {
  _id: string;
  name?: {
    en: string;
    he: string;
  };
  description?: {
    en: string;
    he: string;
  };
  studioName:{
    en: string;
    he?: string;
  }
  address?: string;
  lat?: number;
  lng?: number;
  categories?: string[];
  subCategories?: string[];
  genres?: string[];
  price?: number;
  pricePer?: 'hour' | 'session' | 'unit' | 'song';
  imageUrl?: string;
  idx?: number;
  inStock: boolean;
  studioId: string;
  studioImgUrl?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  paypalMerchantId?: string;
  availability?: Availability[];
  instantBook?: boolean;
}
