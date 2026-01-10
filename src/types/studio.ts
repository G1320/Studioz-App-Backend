import StudioItem from './studioItem.js';



export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface StudioAvailability {
  days: DayOfWeek[];
  times: { start: string; end: string }[];
}

export interface CancellationPolicy {
  type: 'flexible' | 'moderate' | 'strict';
  houseRules?: {
    en?: string;
    he?: string;
  };
}

export interface EquipmentCategory {
  category: string;
  items: string; // Raw text input - items separated by newlines or commas
}

export interface PortfolioItem {
  id: string;
  title: string;
  artist: string;
  type: 'audio' | 'video' | 'album';
  coverUrl?: string;
  link: string;
  role?: string; // e.g., "Mixed", "Mastered", "Recorded"
}

export interface SocialLinks {
  spotify?: string;
  soundcloud?: string;
  appleMusic?: string;
  youtube?: string;
  instagram?: string;
  website?: string;
}

export default interface Studio {
  _id: string;
  name:{
    en: string;
    he?: string;
  }
  subtitle?:{
    en?: string;
    he?: string;
  }
  description:{
    en: string;
    he?: string;
  }
  categories?: string[];
  subCategories?: string[];
  genres?: string[];
  // Payment integration
  paymentEnabled?: boolean;
  amenities?: string[];
  equipment?: EquipmentCategory[];
  averageRating?: number;
  reviewCount?: number;
  totalBookings?: number;
  maxOccupancy?: number;
  size?: number; // Square meters
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
  parking?: 'private' | 'street' | 'paid' | 'none';
  arrivalInstructions?: string;
  cancellationPolicy?: CancellationPolicy;
  createdAt: Date;
  createdBy: string;
  isFeatured?: boolean;
  items: StudioItem[];
  studioAvailability?: StudioAvailability;
  portfolio?: PortfolioItem[];
  socialLinks?: SocialLinks;
}
