
export default interface Item {
  _id: string;
  studio: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  price?: number;
  imageUrl?: string;
  idx?: number;
  inStock: boolean;
  studioId: string;
  studioName: string;
  studioImgUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}



