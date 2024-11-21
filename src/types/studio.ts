import StudioItem from './studioItem.js';

export default interface Studio {
  _id: string;
  name: string;
  description: string;
  categories?: string[];
  subCategories?: string[];
  maxOccupancy?: number;
  isSmokingAllowed?: boolean;
  city: string;
  address?: string;
  isWheelchairAccessible?: boolean;
  coverImage?: string;
  galleryImages?: string[];
  galleryAudioFiles?: string[];
  coverAudioFile?: string;
  isSelfService?: boolean;
  createdAt: Date;
  createdBy: string;
  isFeatured?: boolean;
  items: StudioItem[];
}
