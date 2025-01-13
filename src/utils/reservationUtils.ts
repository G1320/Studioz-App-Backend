// utils/reservationUtils.ts
import { ItemModel } from '../models/itemModel.js';
import { ReservationModel } from '../models/reservationModel.js';
import type { UpdateWriteOpResult } from 'mongoose';
import { addTimeSlots, findOrCreateDateAvailability, initializeAvailability } from './timeSlotUtils.js';
import { emitAvailabilityUpdate } from '../webSockets/socket.js';
import Reservation from '../types/reservation.js';

export const RESERVATION_STATUS = {
  PENDING: 'pending' as const,
  EXPIRED: 'expired' as const,
  CONFIRMED: 'confirmed' as const,
} as const;

const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);


export type ReservationStatus = typeof RESERVATION_STATUS[keyof typeof RESERVATION_STATUS];

// Function to check if a reservation is expired
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

export const updateExpiredReservations = async (): Promise<UpdateWriteOpResult> => {
  try {
    // Find all expired reservations that are still pending
    const expiredReservations = await ReservationModel.find({
      status: RESERVATION_STATUS.PENDING,
      expiration: { $lt: new Date() }
    });

    console.log('Found expired reservations:', expiredReservations.length);
    if (expiredReservations.length > 0) {
      console.log('Expired reservations details:', expiredReservations);
    }

    // For each expired reservation, release its time slots back to availability
    await Promise.all(
      expiredReservations.map(reservation => releaseReservationTimeSlots(reservation))
    );

    // Update their status to expired
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
      console.log(`Released time slots and updated ${result.modifiedCount} expired reservations`);
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