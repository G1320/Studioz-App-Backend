export default interface AddOn {
  _id: string;
  name: {
    en: string;
    he?: string;
  };
  description?: {
    en: string;
    he?: string;
  };
  price: number;
  pricePer?: 'hour' | 'session' | 'unit' | 'song';
  itemId?: string;
  isActive: boolean;
  idx?: number;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

