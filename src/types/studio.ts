// shared/types/studio.ts
import { Types } from 'mongoose';
import StudioItem from './studioItem.js';

export default interface Studio {
  _id?: Types.ObjectId;
  name: string;
  description: string;
  category?: string;
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
  createdAt?: Date;
  createdBy: Types.ObjectId;
  isFeatured?: boolean;
  subCategory?: string;
  items: StudioItem[]
  ;
}

