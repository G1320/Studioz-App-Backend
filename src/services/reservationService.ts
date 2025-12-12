import { ReservationModel } from '../models/reservationModel.js';
import { emitReservationUpdate } from '../webSockets/socket.js';
import { UserModel } from '../models/userModel.js';
import { StudioModel } from '../models/studioModel.js';
import { releaseReservationTimeSlots } from '../api/handlers/bookingHandler.js';
import { notifyCustomerReservationExpired } from '../utils/notificationUtils.js';

export const RESERVATION_STATUS = {
  PENDING: 'pending' as const,
  EXPIRED: 'expired' as const,
  CONFIRMED: 'confirmed' as const,
  CANCELLED: 'cancelled' as const,
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
        
        // Collect all unique customer/user IDs affected by expired reservations
        const affectedUserIds = new Set<string>();
        expiredReservations.forEach(reservation => {
          if (reservation.customerId) {
            affectedUserIds.add(reservation.customerId.toString());
          }
          if (reservation.userId) {
            affectedUserIds.add(reservation.userId.toString());
          }
        });
        
        // Also collect studio owner IDs to invalidate their queries
        const affectedStudioIds = new Set<string>();
        expiredReservations.forEach(reservation => {
          if (reservation.studioId) {
            affectedStudioIds.add(reservation.studioId.toString());
          }
        });
        
        // Look up studio owners
        if (affectedStudioIds.size > 0) {
          const studios = await StudioModel.find({ 
            _id: { $in: Array.from(affectedStudioIds) } 
          }).select('createdBy');
          studios.forEach(studio => {
            if (studio.createdBy) {
              affectedUserIds.add(studio.createdBy.toString());
            }
          });
        }

        // Release time slots (this already emits availability updates)
        await Promise.all(
          expiredReservations.map(reservation => releaseReservationTimeSlots(reservation))
        );
        
        // Clean up user carts in database
        await UserModel.updateMany(
          { 'cart.items.reservationId': { $in: expiredReservationIds } },
          { $pull: { 'cart.items': { reservationId: { $in: expiredReservationIds } } } }
        );
  
        // Emit reservation updates for each affected user to invalidate their queries
        // This ensures all users with expired reservations get their queries invalidated
        // Since io.emit broadcasts to all clients, each user's frontend will receive the update
        // and invalidate queries based on the reservationIds
        if (affectedUserIds.size > 0) {
          affectedUserIds.forEach(userId => {
            emitReservationUpdate(expiredReservationIds, userId);
          });
        } else if (expiredReservationIds.length > 0) {
          // Fallback: emit even if no userIds found (shouldn't happen, but safety check)
          emitReservationUpdate(expiredReservationIds, '');
        }
        
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