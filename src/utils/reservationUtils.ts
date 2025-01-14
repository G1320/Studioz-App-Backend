import { ItemModel } from '../models/itemModel.js';
import { ReservationModel } from '../models/reservationModel.js';
import { addTimeSlots, findOrCreateDateAvailability, initializeAvailability } from './timeSlotUtils.js';
import { emitAvailabilityUpdate, emitReservationUpdate } from '../webSockets/socket.js';
import Reservation from '../types/reservation.js';
import { UserModel } from '../models/userModel.js';

export const RESERVATION_STATUS = {
  PENDING: 'pending' as const,
  EXPIRED: 'expired' as const,
  CONFIRMED: 'confirmed' as const,
} as const;

const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);


export type ReservationStatus = typeof RESERVATION_STATUS[keyof typeof RESERVATION_STATUS];

export const isReservationExpired = (expiration: Date): boolean => {
  return new Date() > new Date(expiration);
};

export const releaseReservationTimeSlots = async (reservation: Reservation) => {
    const item = await ItemModel.findById(reservation.itemId);
    if (!item) {
        console.log('Item not found for reservation:', reservation._id);
        return;
    }
  
    // Initialize availability if needed
    item.availability = initializeAvailability(item.availability);
    
    // Find or create availability entry for the booking date
    const dateAvailability = findOrCreateDateAvailability(
      item.availability, 
      reservation.bookingDate, 
      defaultHours
    );

    // Add the expired reservation's time slots back to availability
    dateAvailability.times = addTimeSlots(dateAvailability.times, reservation.timeSlots);
  

    // Update item's availability
    item.availability = item.availability.map(avail =>
      avail.date === reservation.bookingDate ? dateAvailability : avail
    );
  
    await item.save();
    emitAvailabilityUpdate(item._id);
};

export const updateExpiredReservations = async () => {
    try {
      // Find all expired reservations that are still pending
      const expiredReservations = await ReservationModel.find({
        status: RESERVATION_STATUS.PENDING,
        expiration: { $lt: new Date() }
      });
  
      if (expiredReservations.length > 0) {
        const expiredReservationIds = expiredReservations.map(r => r._id.toString());
        const costumerId = expiredReservations.find(r => r.costumerId)?.costumerId; // Get one costumerId

  
        // Release time slots
        await Promise.all(
          expiredReservations.map(reservation => releaseReservationTimeSlots(reservation))
        );
        // Clean up user carts in database
        await UserModel.updateMany(
          { 'cart.items.reservationId': { $in: expiredReservationIds } },
          { $pull: { 'cart.items': { reservationId: { $in: expiredReservationIds } } } }
        );
  
        // Clean up offline cart or trigger query invalidation through socket event
         emitReservationUpdate( expiredReservationIds, costumerId || '' );
        // Update reservation status to expired
        return  await ReservationModel.updateMany(
          {
            status: RESERVATION_STATUS.PENDING,
            expiration: { $lt: new Date() }
          },
          {
            $set: { status: RESERVATION_STATUS.EXPIRED }
          }
        );
      }
    } catch (error) {
      console.error('Error updating expired reservations:', error);
      throw error;
    }
  };

export const cleanupExpiredReservations = async (): Promise<{ deletedCount: number }> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await ReservationModel.deleteMany({
      status: RESERVATION_STATUS.EXPIRED,
      expiration: { $lt: thirtyDaysAgo }
    });

    return result;
  } catch (error) {
    console.error('Error cleaning up expired reservations:', error);
    throw error;
  }
};