export default interface CartItem {
    name?: string;
    price?: number;
    itemId: string;
    quantity?: number;
    bookingDate?: Date | string; 
    studioName?: string;
    studioId?: string;
  }