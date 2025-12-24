import StudioItem from './studioItem.js';



export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface StudioAvailability {
  days: DayOfWeek[];
  times: { start: string; end: string }[];
}

export default interface Studio {
  _id: string;
  name:{
    en: string;
    he?: string;
  }
  subtitle:{
    en: string;
    he?: string;
  }
  description:{
    en: string;
    he?: string;
  }
  categories?: string[];
  subCategories?: string[];
  genres?: string[];
  averageRating?: number;
  reviewCount?: number;
  maxOccupancy?: number;
  isSmokingAllowed?: boolean;
  city: string;
  address?: string;
  phone?: string;
  website?: string;
  socials?: {
    instagram?: string;
    facebook?: string;
  };
  lat?: number;
  lng?: number;
  isWheelchairAccessible?: boolean;
  coverImage?: string;
  galleryImages?: string[];
  galleryAudioFiles?: string[];
  coverAudioFile?: string;
  isSelfService?: boolean;
  parking?: 'none' | 'free' | 'paid';
  createdAt: Date;
  createdBy: string;
  isFeatured?: boolean;
  items: StudioItem[];
  studioAvailability?: StudioAvailability;
}
