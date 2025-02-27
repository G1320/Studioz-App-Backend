export default interface CartItem {
  name:{
    en: string;
    he?: string;
  }
  studioName:{
    en: string;
    he?: string;
  }
  price?: number;
  pricePer?: 'hour' | 'session' | 'unit' | 'song';
  total?: number;
  itemId: string;
  quantity?: number;
  bookingDate?: string ;
  startTime?: string;
  studioId?: string;
  reservationId?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  comment?: string;
}
