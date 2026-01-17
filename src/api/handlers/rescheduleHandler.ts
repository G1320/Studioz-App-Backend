import { Request } from 'express';
import handleRequest from '../../utils/requestHandler.js';
import ExpressError from '../../utils/expressError.js';
import rescheduleService from '../../services/rescheduleService.js';

/**
 * Get available time slots for rescheduling a reservation
 * GET /api/reservations/:reservationId/reschedule/available
 */
export const getAvailableSlots = handleRequest(async (req: Request) => {
  const { reservationId } = req.params;
  const daysAhead = parseInt(req.query.days as string) || 14;

  if (!reservationId) {
    throw new ExpressError('Reservation ID is required', 400);
  }

  if (daysAhead < 1 || daysAhead > 60) {
    throw new ExpressError('Days ahead must be between 1 and 60', 400);
  }

  try {
    const result = await rescheduleService.getAvailableSlotsForReschedule(reservationId, daysAhead);
    return result;
  } catch (error: any) {
    throw new ExpressError(error.message || 'Failed to get available slots', 400);
  }
});

/**
 * Check if a specific date/time is available for rescheduling
 * POST /api/reservations/:reservationId/reschedule/check
 */
export const checkAvailability = handleRequest(async (req: Request) => {
  const { reservationId } = req.params;
  const { date, timeSlots } = req.body;

  if (!reservationId) {
    throw new ExpressError('Reservation ID is required', 400);
  }

  if (!date) {
    throw new ExpressError('Date is required', 400);
  }

  if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
    throw new ExpressError('Time slots array is required', 400);
  }

  try {
    const result = await rescheduleService.checkRescheduleAvailability(reservationId, date, timeSlots);
    return result;
  } catch (error: any) {
    throw new ExpressError(error.message || 'Failed to check availability', 400);
  }
});

/**
 * Reschedule a reservation to a new date/time
 * POST /api/reservations/:reservationId/reschedule
 */
export const reschedule = handleRequest(async (req: Request) => {
  const { reservationId } = req.params;
  const { date, timeSlots } = req.body;
  const userId = req.query.userId as string || (req as any).user?.id;

  if (!reservationId) {
    throw new ExpressError('Reservation ID is required', 400);
  }

  if (!date) {
    throw new ExpressError('Date is required', 400);
  }

  if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
    throw new ExpressError('Time slots array is required', 400);
  }

  const result = await rescheduleService.rescheduleReservation(
    reservationId,
    date,
    timeSlots,
    userId
  );

  if (!result.success) {
    throw new ExpressError(result.error || 'Failed to reschedule reservation', 400);
  }

  return result.reservation;
});

export default {
  getAvailableSlots,
  checkAvailability,
  reschedule
};
