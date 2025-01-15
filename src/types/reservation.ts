import { RESERVATION_STATUS } from '../services/reservationService.js';


export default interface Reservation {
_id: string;
itemId: string;
userId: string;
bookingDate: string;
studioId: string;
timeSlots: string[];
status: typeof RESERVATION_STATUS[keyof typeof RESERVATION_STATUS];
expiration: Date;
createdAt?: Date;
updatedAt?: Date;
itemName: {
    en: string;
    he?: string;
  };
itemPrice?: number;
totalPrice?: number;
orderId?: string;
costumerName?: string;
costumerPhone?: string;
costumerId?: string;
comment?: string;
}