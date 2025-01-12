// utils/reservationUtils.ts
import { ReservationModel } from '../models/reservationModel.js';
import type { UpdateWriteOpResult } from 'mongoose';

export const RESERVATION_STATUS = {
  PENDING: 'pending' as const,
  EXPIRED: 'expired' as const,
  CONFIRMED: 'confirmed' as const,
} as const;

export type ReservationStatus = typeof RESERVATION_STATUS[keyof typeof RESERVATION_STATUS];

// Function to check if a reservation is expired
export const isReservationExpired = (expiration: Date): boolean => {
  return new Date() > new Date(expiration);
};

export const updateExpiredReservations = async (): Promise<UpdateWriteOpResult> => {
  try {
    const result = await ReservationModel.updateMany(
      {
        status: RESERVATION_STATUS.PENDING,
        expiration: { $lt: new Date() }
      },
      {
        $set: { status: RESERVATION_STATUS.EXPIRED }
      }
    );

    if (result.modifiedCount > 0) {
        console.log(`Updated ${result.modifiedCount} expired reservations`);
      }
    
    return result;
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