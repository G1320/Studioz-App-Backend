export default interface CartItem {
  name?: string;
  price?: number;
  total?: number;
  itemId: string;
  quantity?: number;
  bookingDate?: string ;
  startTime?: string;
  studioName?: string;
  studioId?: string;
}
