import Availability from './availability.js';

export interface Duration {
  value: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface AdvanceBookingRequired {
  value: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface BlockDiscounts {
  eightHour?: number;
  twelveHour?: number;
}

export default interface Item {
  _id: string;
  name?: {
    en: string;
    he: string;
  };
  subtitle?: {
    en: string;
    he?: string;
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
  city?: string;
  lat?: number;
  lng?: number;
  categories?: string[];
  subCategories?: string[];
  genres?: string[];
  price?: number;
  pricePer?: 'hour' | 'session' | 'unit' | 'song' | 'project' | 'day';
  blockDiscounts?: BlockDiscounts;
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
  addOnIds?: string[];
  
  // Booking Requirements
  minimumBookingDuration?: Duration;
  minimumQuantity?: number;
  advanceBookingRequired?: AdvanceBookingRequired;
  
  // Setup & Preparation
  preparationTime?: Duration;
  
  // Remote Service
  remoteService?: boolean;
  remoteAccessMethod?: 'zoom' | 'teams' | 'skype' | 'custom' | 'other';
  softwareRequirements?: string[];
  
  // Quantity Management
  maxQuantityPerBooking?: number;
  
  // Status
  active?: boolean;
}
