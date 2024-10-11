export default interface CartItem {
  name?: string;
  price?: number;
  total?: number;
  itemId: string;
  quantity?: number;
  bookingDate?: Date | string;
  studioName?: string;
  studioId?: string;
}
