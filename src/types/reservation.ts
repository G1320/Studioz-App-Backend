import { RESERVATION_STATUS } from '../utils/reservationUtils.js';


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
itemPrice?: number;
totalPrice?: number;
costumerName?: string;
  costumerPhone?: string;
  costumerId?: string;
  comment?: string;
}