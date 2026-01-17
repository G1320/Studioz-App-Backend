import { ReservationModel } from '../models/reservationModel.js';
import { ItemModel } from '../models/itemModel.js';
import { StudioModel } from '../models/studioModel.js';
import { emitReservationUpdate } from '../webSockets/socket.js';
import {
  updateReservationAvailability,
  checkSlotsAvailable,
  getStudioOperatingHours
} from './availabilityService.js';
import {
  initializeAvailability,
  findOrCreateDateAvailability
} from '../utils/timeSlotUtils.js';

export interface AvailableSlot {
  date: string;
  timeSlots: string[];
  isFullyAvailable: boolean;
}

export interface RescheduleResult {
  success: boolean;
  reservation?: any;
  error?: string;
}

/**
 * Get available time slots for rescheduling a reservation
 * Shows availability for the same item over the next N days
 */
export const getAvailableSlotsForReschedule = async (
  reservationId: string,
  daysAhead: number = 14
): Promise<{ slots: AvailableSlot[]; originalSlotCount: number }> => {
  const reservation = await ReservationModel.findById(reservationId);
  if (!reservation) {
    throw new Error('Reservation not found');
  }

  const item = await ItemModel.findById(reservation.itemId);
  if (!item) {
    throw new Error('Item not found');
  }

  // Get studio operating hours
  const studioHours = await getStudioOperatingHours(reservation.studioId?.toString());

  // Initialize availability if needed
  const availability = initializeAvailability(item.availability);

  const originalSlotCount = reservation.timeSlots?.length || 1;
  const slots: AvailableSlot[] = [];

  // Generate dates for the next N days
  const today = new Date();
  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    // Format as DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dateStr = `${day}/${month}/${year}`;

    // Skip the current booking date (user should pick a different date)
    if (dateStr === reservation.bookingDate) continue;

    // Get availability for this date
    const dateAvailability = findOrCreateDateAvailability(availability, dateStr, studioHours);

    // Add back the current reservation's slots if it's the same date
    // (since they would be released when rescheduling)
    let availableTimes = [...dateAvailability.times];

    if (availableTimes.length > 0) {
      slots.push({
        date: dateStr,
        timeSlots: availableTimes.sort(),
        isFullyAvailable: availableTimes.length >= originalSlotCount
      });
    }
  }

  return { slots, originalSlotCount };
};

/**
 * Check if a specific date/time combination is available for rescheduling
 */
export const checkRescheduleAvailability = async (
  reservationId: string,
  newDate: string,
  newTimeSlots: string[]
): Promise<{ available: boolean; conflictingSlots?: string[] }> => {
  const reservation = await ReservationModel.findById(reservationId);
  if (!reservation) {
    throw new Error('Reservation not found');
  }

  // If rescheduling to the same date, the current slots would be released first
  if (newDate === reservation.bookingDate) {
    // Check if any of the new slots overlap with the current reservation
    const currentSlots = new Set(reservation.timeSlots || []);
    const overlappingSlots = newTimeSlots.filter(slot => currentSlots.has(slot));
    const nonOverlappingSlots = newTimeSlots.filter(slot => !currentSlots.has(slot));

    // Only need to check availability for non-overlapping slots
    if (nonOverlappingSlots.length === 0) {
      return { available: true };
    }

    const available = await checkSlotsAvailable(
      reservation.itemId.toString(),
      newDate,
      nonOverlappingSlots
    );

    if (!available) {
      return { available: false, conflictingSlots: nonOverlappingSlots };
    }
    return { available: true };
  }

  // Different date - check full availability
  const available = await checkSlotsAvailable(
    reservation.itemId.toString(),
    newDate,
    newTimeSlots
  );

  if (!available) {
    return { available: false, conflictingSlots: newTimeSlots };
  }

  return { available: true };
};

/**
 * Reschedule a reservation to a new date/time
 * Handles availability updates and notifications
 */
export const rescheduleReservation = async (
  reservationId: string,
  newDate: string,
  newTimeSlots: string[],
  userId?: string
): Promise<RescheduleResult> => {
  const reservation = await ReservationModel.findById(reservationId);
  if (!reservation) {
    return { success: false, error: 'Reservation not found' };
  }

  // Only confirmed or pending reservations can be rescheduled
  if (!['confirmed', 'pending'].includes(reservation.status)) {
    return { success: false, error: `Cannot reschedule reservation with status: ${reservation.status}` };
  }

  // Verify user has permission to reschedule (customer or vendor)
  if (userId) {
    const customerId = reservation.customerId?.toString() || reservation.userId?.toString();
    const isCustomer = customerId === userId;

    // Check if user is the vendor
    let isVendor = false;
    if (reservation.studioId) {
      const studio = await StudioModel.findById(reservation.studioId);
      isVendor = studio?.createdBy?.toString() === userId;
    }

    if (!isCustomer && !isVendor) {
      return { success: false, error: 'Not authorized to reschedule this reservation' };
    }
  }

  // Validate new time slots
  if (!newTimeSlots || newTimeSlots.length === 0) {
    return { success: false, error: 'New time slots are required' };
  }

  // Validate date format (DD/MM/YYYY)
  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!dateRegex.test(newDate)) {
    return { success: false, error: 'Invalid date format. Use DD/MM/YYYY' };
  }

  // Check if the new date is not in the past
  const [day, month, year] = newDate.split('/').map(Number);
  const newBookingDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (newBookingDate < today) {
    return { success: false, error: 'Cannot reschedule to a past date' };
  }

  // Store previous values
  const previousDate = reservation.bookingDate;
  const previousSlots = [...reservation.timeSlots];

  // Check availability and update
  const availabilityResult = await updateReservationAvailability(
    reservation.itemId.toString(),
    reservation.studioId?.toString(),
    previousDate,
    previousSlots,
    newDate,
    newTimeSlots
  );

  if (!availabilityResult.success) {
    return { success: false, error: availabilityResult.error || 'Failed to update availability' };
  }

  // Update reservation
  reservation.bookingDate = newDate;
  reservation.timeSlots = newTimeSlots;

  // Recalculate price if slot count changed
  if (newTimeSlots.length !== previousSlots.length) {
    reservation.markModified('timeSlots');
  }

  await reservation.save();

  // Emit update
  const bookerId = reservation.customerId?.toString() || reservation.userId?.toString() || '';
  emitReservationUpdate([reservation._id.toString()], bookerId);

  // Sync to Google Calendar if connected
  try {
    const { syncReservationToCalendar } = await import('./googleCalendarService.js');
    await syncReservationToCalendar(reservation);
  } catch (error) {
    console.error('Error syncing rescheduled reservation to Google Calendar:', error);
  }

  return { success: true, reservation };
};

export default {
  getAvailableSlotsForReschedule,
  checkRescheduleAvailability,
  rescheduleReservation
};
