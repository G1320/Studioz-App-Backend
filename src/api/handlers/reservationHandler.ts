import { Request } from 'express';
import { ReservationModel } from '../../models/reservationModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { RESERVATION_STATUS, isReservationExpired, updateExpiredReservations } from '../../services/reservationService.js';
import { emitReservationUpdate } from '../../webSockets/socket.js';
import { releaseReservationTimeSlots } from '../handlers/bookingHandler.js';
import { updateReservationAvailability } from '../../services/availabilityService.js';
import {
  notifyVendorReservationCancelled,
  notifyCustomerReservationConfirmed,
  notifyBookerReservationCancelled
} from '../../utils/notificationUtils.js';
import { paymentService } from '../../services/paymentService.js';

const createReservation = handleRequest(async (req: Request) => {
  const { studioId, itemId, userId, reservationDetails, addOnIds } = req.body;

  if (!studioId) throw new ExpressError('Studio ID not provided', 400);
  if (!itemId) throw new ExpressError('Item ID not provided', 400);
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('Studio not found', 404);

  const item = await ItemModel.findById(itemId);
  if (!item) throw new ExpressError('Item not found', 404);

  // Set expiration time to 15 minutes from now
  const expirationTime = new Date();
  expirationTime.setMinutes(expirationTime.getMinutes() + 15);

  // Set status based on instantBook: CONFIRMED if true, PENDING if false
  const reservationStatus = item.instantBook 
    ? RESERVATION_STATUS.CONFIRMED 
    : RESERVATION_STATUS.PENDING;

  const reservation = new ReservationModel({
    studioId,
    itemId,
    itemName: item.name,
    studioName: studio.name,
    userId,
    reservationDetails,
    status: reservationStatus,
    expiration: expirationTime,
    addOnIds: addOnIds || []
  });

  await reservation.save();
  emitReservationUpdate([reservation._id.toString()], userId.toString());
  
  // Increment totalBookings on studio when reservation is confirmed
  if (reservation.status === RESERVATION_STATUS.CONFIRMED && reservation.studioId) {
    await StudioModel.findByIdAndUpdate(
      reservation.studioId,
      { $inc: { totalBookings: 1 } }
    );
  }

  // Sync to Google Calendar if connected
  try {
    const { syncReservationToCalendar } = await import('../../services/googleCalendarService.js');
    await syncReservationToCalendar(reservation);
  } catch (error) {
    console.error('Error syncing reservation to Google Calendar:', error);
    // Don't fail the reservation creation if calendar sync fails
  }
  
  return reservation;
});



const getReservations = handleRequest(async (req: Request) => {
  const { studioId, userId, page: pageStr, limit: limitStr } = req.query;

  // Update expired reservations before fetching
  await updateExpiredReservations();

  // Pagination parameters with sensible defaults
  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr as string) || 50));
  const skip = (page - 1) * limit;

  // Build filter conditions
  const filter: Record<string, unknown> = {};
  if (studioId) filter.studioId = studioId;
  if (userId) filter.userId = userId;

  const [reservations, total] = await Promise.all([
    ReservationModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    ReservationModel.countDocuments(filter)
  ]);

  return {
    reservations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
});

const getReservationsByStudioId = handleRequest(async (req: Request) => {
  const { studioId } = req.params;

  if (!studioId) throw new ExpressError('Studio ID not provided', 400);

  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('Studio not found', 404);

  // Update expired reservations before fetching
  await updateExpiredReservations();
  
  const reservations = await ReservationModel.find({ studioId });
  return reservations;
});

const getReservationsByPhone = handleRequest(async (req: Request) => {
  const { phone } = req.params;

  if (!phone) throw new ExpressError('Phone number not provided', 400);

  // Update expired reservations before fetching
  await updateExpiredReservations();
  
  const reservations = await ReservationModel.find({ customerPhone: phone });
  return reservations;
});

const getReservationById = handleRequest(async (req: Request) => {
  const { reservationId } = req.params;
  if (!reservationId) throw new ExpressError('Reservation ID not provided', 400);

  const reservation = await ReservationModel.findById(reservationId);
  if (!reservation) throw new ExpressError('Reservation not found', 404);

  // Check if pending reservation is expired
  if (reservation.status === RESERVATION_STATUS.PENDING && 
      isReservationExpired(reservation.expiration)) {
    reservation.status = RESERVATION_STATUS.EXPIRED;
    await reservation.save();
  }

  return reservation;
});

const updateReservationById = handleRequest(async (req: Request) => {
  const { reservationId } = req.params;
  if (!reservationId) throw new ExpressError('Reservation ID not provided', 400);

  const reservation = await ReservationModel.findById(reservationId);
  if (!reservation) throw new ExpressError('Reservation not found', 404);

  // Prevent updates to expired reservations
  if (reservation.status === RESERVATION_STATUS.PENDING && 
      isReservationExpired(reservation.expiration)) {
    throw new ExpressError('Cannot update expired reservation', 400);
  }

  // Store previous values for availability management
  const previousStatus = reservation.status;
  const previousItemId = reservation.itemId?.toString();
  const previousTimeSlots = [...reservation.timeSlots];
  const previousBookingDate = reservation.bookingDate;

  // Check if fields that affect price are being updated
  const priceAffectingFields = ['addOnIds', 'timeSlots', 'itemPrice'];
  const shouldRecalculatePrice = priceAffectingFields.some(field => req.body[field] !== undefined);

  // Check if availability-affecting fields are being updated
  const newTimeSlots = req.body.timeSlots;
  const newBookingDate = req.body.bookingDate;
  const timeSlotsChanged = newTimeSlots !== undefined && JSON.stringify(newTimeSlots) !== JSON.stringify(previousTimeSlots);
  const bookingDateChanged = newBookingDate !== undefined && newBookingDate !== previousBookingDate;
  const shouldUpdateAvailability = timeSlotsChanged || bookingDateChanged;

  // Update item availability if time slots or booking date changed
  if (shouldUpdateAvailability) {
    const actualNewDate = newBookingDate || previousBookingDate;
    const actualNewSlots = newTimeSlots || previousTimeSlots;

    const result = await updateReservationAvailability(
      reservation.itemId.toString(),
      reservation.studioId?.toString(),
      previousBookingDate,
      previousTimeSlots,
      actualNewDate,
      actualNewSlots
    );

    if (!result.success) {
      throw new ExpressError(result.error || 'Failed to update availability', 400);
    }
  }

  const updatedReservation = await ReservationModel.findByIdAndUpdate(
    reservationId,
    req.body,
    { new: true }
  );
  
  if (updatedReservation) {
    // Mark price-affecting fields as modified so pre-save hook knows to recalculate totalPrice
    // Since findByIdAndUpdate doesn't track modifications, we need to explicitly mark them
    if (shouldRecalculatePrice) {
      if (req.body.addOnIds !== undefined) updatedReservation.markModified('addOnIds');
      if (req.body.timeSlots !== undefined) updatedReservation.markModified('timeSlots');
      if (req.body.itemPrice !== undefined) updatedReservation.markModified('itemPrice');
      await updatedReservation.save(); // Pre-save hook will recalculate totalPrice
    }

    const bookerId = updatedReservation.customerId?.toString() || updatedReservation.userId?.toString() || '';

    emitReservationUpdate(
      [updatedReservation._id.toString()],
      bookerId
    );

    // Notify customer when status changes to confirmed or cancelled
    if (previousStatus !== updatedReservation.status && bookerId) {
      if (updatedReservation.status === RESERVATION_STATUS.CONFIRMED) {
        // ============================================================
        // PAYMENT CHARGING on confirmation
        // If reservation has a saved card, charge it before confirming
        // (Same logic as approveReservation endpoint)
        // ============================================================
        console.log('[Payment Debug] Reservation confirmed via PUT:', {
          previousStatus,
          paymentStatus: updatedReservation.paymentStatus,
          hasSumitCustomerId: !!updatedReservation.paymentDetails?.sumitCustomerId,
          reservationId: updatedReservation._id
        });

        if (previousStatus === RESERVATION_STATUS.PENDING && 
            updatedReservation.paymentStatus === 'card_saved' && 
            updatedReservation.paymentDetails?.sumitCustomerId) {
          try {
            const chargeResult = await paymentService.chargeReservation(updatedReservation);

            if (chargeResult.paymentStatus === 'charged') {
              updatedReservation.paymentStatus = 'charged';
              if (updatedReservation.paymentDetails) {
                updatedReservation.paymentDetails.sumitPaymentId = chargeResult.sumitPaymentId;
                updatedReservation.paymentDetails.chargedAt = chargeResult.chargedAt;
              }
              await updatedReservation.save();
            } else {
              // Payment failed - revert to pending
              updatedReservation.status = RESERVATION_STATUS.PENDING;
              updatedReservation.paymentStatus = 'failed';
              if (updatedReservation.paymentDetails) {
                updatedReservation.paymentDetails.failureReason = chargeResult.failureReason;
              }
              await updatedReservation.save();
              throw new ExpressError(
                `Payment failed: ${chargeResult.failureReason}. Reservation not confirmed.`,
                400
              );
            }
          } catch (paymentError: any) {
            if (paymentError instanceof ExpressError) {
              throw paymentError;
            }
            console.error('Payment error during confirmation:', paymentError);
          }
        }

        await notifyCustomerReservationConfirmed(
          updatedReservation._id.toString(),
          bookerId
        );
        
        // Increment totalBookings on studio when reservation is confirmed
        if (updatedReservation.studioId) {
          await StudioModel.findByIdAndUpdate(
            updatedReservation.studioId,
            { $inc: { totalBookings: 1 } }
          );
        }
      } else if (updatedReservation.status === RESERVATION_STATUS.CANCELLED) {
        await notifyBookerReservationCancelled(
          updatedReservation._id.toString(),
          bookerId
        );
      }
    }

    // Sync to Google Calendar if connected
    try {
      const { syncReservationToCalendar } = await import('../../services/googleCalendarService.js');
      await syncReservationToCalendar(updatedReservation);
    } catch (error) {
      console.error('Error syncing reservation to Google Calendar:', error);
      // Don't fail the reservation update if calendar sync fails
    }
  }

  return updatedReservation;
});

const cancelReservationById = handleRequest(async (req: Request) => {
  const { reservationId } = req.params;
  if (!reservationId) throw new ExpressError('Reservation ID not provided', 400);

  const reservation = await ReservationModel.findById(reservationId);
  if (!reservation) throw new ExpressError('Reservation not found', 404);

  // If already cancelled/rejected/expired, return as-is
  if (
    reservation.status === RESERVATION_STATUS.CANCELLED ||
    reservation.status === RESERVATION_STATUS.REJECTED ||
    reservation.status === RESERVATION_STATUS.EXPIRED
  ) {
    return reservation;
  }

  // ============================================================
  // OPTIONAL REFUND HANDLING
  // If reservation was charged, attempt to refund
  // ============================================================
  if (reservation.paymentStatus === 'charged' && reservation.paymentDetails?.sumitPaymentId) {
    try {
      const refundResult = await paymentService.refundReservation(reservation);
      
      if (refundResult.success) {
        reservation.paymentStatus = 'refunded';
        if (reservation.paymentDetails) {
          reservation.paymentDetails.refundId = refundResult.refundId;
          reservation.paymentDetails.refundedAt = new Date();
        }
      } else {
        // Refund failed - log but still cancel the reservation
        // Vendor will need to handle refund manually
        console.error('Refund failed for reservation:', reservationId, refundResult.error);
      }
    } catch (refundError) {
      // Refund error - log but still cancel the reservation
      console.error('Refund error for reservation:', reservationId, refundError);
    }
  }

  // Release held time slots back to availability
  await releaseReservationTimeSlots(reservation);

  reservation.status = RESERVATION_STATUS.CANCELLED;
  await reservation.save();

  // Refresh reservation from database to ensure we have all fields including googleCalendarEventId
  const cancelledReservation = await ReservationModel.findById(reservationId);
  if (!cancelledReservation) throw new ExpressError('Reservation not found after cancellation', 404);

  // Notify vendor of the cancellation
  if (cancelledReservation.studioId) {
    await notifyVendorReservationCancelled(
      cancelledReservation._id.toString(),
      cancelledReservation.studioId.toString(),
      cancelledReservation.itemId.toString(),
      cancelledReservation.customerName
    );
  }

  // Notify customer of the cancellation
  const bookerId = cancelledReservation.customerId?.toString() || cancelledReservation.userId?.toString() || '';
  if (bookerId) {
    await notifyBookerReservationCancelled(
      cancelledReservation._id.toString(),
      bookerId
    );
  }

  emitReservationUpdate(
    [cancelledReservation._id.toString()],
    cancelledReservation.customerId?.toString() || cancelledReservation.userId?.toString() || ''
  );

  // Sync to Google Calendar if connected (will delete event)
  try {
    const { syncReservationToCalendar } = await import('../../services/googleCalendarService.js');
    await syncReservationToCalendar(cancelledReservation);
  } catch (error) {
    console.error('Error syncing reservation to Google Calendar:', error);
    // Don't fail the reservation cancellation if calendar sync fails
  }

  return cancelledReservation;
});

/**
 * Approve a pending reservation (vendor action)
 * If the reservation has a saved card (paymentStatus === 'card_saved'), 
 * this will charge the card before confirming.
 * If no payment is attached, it simply confirms the reservation.
 */
const approveReservation = handleRequest(async (req: Request) => {
  const { reservationId } = req.params;
  if (!reservationId) throw new ExpressError('Reservation ID not provided', 400);

  const reservation = await ReservationModel.findById(reservationId);
  if (!reservation) throw new ExpressError('Reservation not found', 404);

  // Only pending reservations can be approved
  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    throw new ExpressError(`Cannot approve reservation with status: ${reservation.status}`, 400);
  }

  // Check if pending reservation is expired
  if (isReservationExpired(reservation.expiration)) {
    reservation.status = RESERVATION_STATUS.EXPIRED;
    await reservation.save();
    throw new ExpressError('Cannot approve expired reservation', 400);
  }

  // ============================================================
  // OPTIONAL PAYMENT CHARGING
  // Only charges if reservation has a saved card (paymentStatus === 'card_saved')
  // If no payment is attached, reservation is simply confirmed
  // ============================================================
  if (reservation.paymentStatus === 'card_saved' && reservation.paymentDetails?.sumitCustomerId) {
    try {
      const chargeResult = await paymentService.chargeReservation(reservation);

      if (chargeResult.paymentStatus === 'charged') {
        reservation.paymentStatus = 'charged';
        if (reservation.paymentDetails) {
          reservation.paymentDetails.sumitPaymentId = chargeResult.sumitPaymentId;
          reservation.paymentDetails.chargedAt = chargeResult.chargedAt;
        }
      } else {
        // Payment failed - don't confirm the reservation
        reservation.paymentStatus = 'failed';
        if (reservation.paymentDetails) {
          reservation.paymentDetails.failureReason = chargeResult.failureReason;
        }
        await reservation.save();
        throw new ExpressError(
          `Payment failed: ${chargeResult.failureReason}. Reservation not approved.`,
          400
        );
      }
    } catch (paymentError: any) {
      // If it's our ExpressError, re-throw it
      if (paymentError instanceof ExpressError) {
        throw paymentError;
      }
      // Otherwise log and continue (vendor may have removed payment requirement)
      console.error('Payment error during approval:', paymentError);
    }
  }

  // Confirm the reservation
  reservation.status = RESERVATION_STATUS.CONFIRMED;
  await reservation.save();

  const bookerId = reservation.customerId?.toString() || reservation.userId?.toString() || '';

  // Notify customer
  if (bookerId) {
    await notifyCustomerReservationConfirmed(
      reservation._id.toString(),
      bookerId
    );
  }

  // Increment totalBookings on studio
  if (reservation.studioId) {
    await StudioModel.findByIdAndUpdate(
      reservation.studioId,
      { $inc: { totalBookings: 1 } }
    );
  }

  emitReservationUpdate([reservation._id.toString()], bookerId);

  // Sync to Google Calendar if connected
  try {
    const { syncReservationToCalendar } = await import('../../services/googleCalendarService.js');
    await syncReservationToCalendar(reservation);
  } catch (error) {
    console.error('Error syncing reservation to Google Calendar:', error);
  }

  return reservation;
});

export default {
  createReservation,
  getReservations,
  getReservationsByStudioId,
  getReservationsByPhone,
  getReservationById,
  updateReservationById,
  cancelReservationById,
  approveReservation,
};