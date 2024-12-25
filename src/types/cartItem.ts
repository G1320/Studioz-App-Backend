export default interface CartItem {
  name?: string;
  price?: number;
  pricePer?: 'hour' | 'session' | 'unit' | 'song';
  total?: number;
  itemId: string;
  quantity?: number;
  bookingDate?: string ;
  startTime?: string;
  studioName?: string;
  studioId?: string;
}
