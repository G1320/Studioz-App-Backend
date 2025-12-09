import { ReservationModel } from '../models/reservationModel.js';
import { emitReservationUpdate } from '../webSockets/socket.js';
import { UserModel } from '../models/userModel.js';
import { releaseReservationTimeSlots } from '../api/handlers/bookingHandler.js';
import { notifyCustomerReservationExpired } from '../utils/notificationUtils.js';

export const RESERVATION_STATUS = {
  PENDING: 'pending' as const,
  EXPIRED: 'expired' as const,
  CONFIRMED: 'confirmed' as const,
  CANCELED: 'canceled' as const,
  REJECTED: 'rejected' as const,
} as const;

export type ReservationStatus = typeof RESERVATION_STATUS[keyof typeof RESERVATION_STATUS];

export const isReservationExpired = (expiration: Date): boolean => {
  return new Date() > new Date(expiration);
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
        const customerId = expiredReservations.find(r => r.customerId)?.customerId; // Get one customerId

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
         emitReservationUpdate( expiredReservationIds, customerId || '' );
        
        // Notify customers about expired reservations
        for (const reservation of expiredReservations) {
          if (reservation.customerId) {
            await notifyCustomerReservationExpired(
              reservation._id.toString(),
              reservation.customerId.toString()
            );
          }
        }

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