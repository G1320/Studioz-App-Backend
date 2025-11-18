export default interface Review {
  _id: string;
  studioId: string;
  userId: string;
  rating: number;
  comment?: string;
  isVerified?: boolean;
  isVisible?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

