
// export default interface Item {
//   _id: string;
//   studio: string;
//   name: string;
//   description?: string;
//   category?: string;
//   subcategory?: string;
//   price?: number;
//   imageUrl?: string;
//   idx?: number;
//   inStock: boolean;
//   studioId: string;
//   studioName: string;
//   studioImgUrl?: string;
//   createdAt?: Date;
//   updatedAt?: Date;
// }

import  Availability  from "./availability.js";

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
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  availability?: Availability[];
}



