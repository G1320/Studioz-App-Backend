export default interface CartItem {
  nameEn?: string;
  nameHe?: string;
  price?: number;
  pricePer?: 'hour' | 'session' | 'unit' | 'song';
  total?: number;
  itemId: string;
  quantity?: number;
  bookingDate?: string ;
  startTime?: string;
  studioNameEn?: string;
  studioNameHe?: string;
  studioId?: string;
}
