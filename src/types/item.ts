import Availability from './availability.js';

export interface Duration {
  value: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface AdvanceBookingRequired {
  value: number;
  unit: 'hours' | 'days';
}

export interface CancellationPolicy {
  type: 'flexible' | 'moderate' | 'strict';
  notes?: {
    en?: string;
    he?: string;
  };
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
  pricePer?: 'hour' | 'session' | 'unit' | 'project' | 'day';
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
  maximumBookingDuration?: Duration;
  advanceBookingRequired?: AdvanceBookingRequired;
  
  // Setup & Preparation
  preparationTime?: Duration;
  bufferTime?: Duration;
  
  // Policies
  cancellationPolicy?: CancellationPolicy;
  
  // Remote Service
  remoteService?: boolean;
  remoteAccessMethod?: 'zoom' | 'teams' | 'skype' | 'custom' | 'other';
  softwareRequirements?: string[];
  
  // Quantity Management
  maxQuantityPerBooking?: number;
  
  // Same-Day Booking
  allowSameDayBooking?: boolean;
}
