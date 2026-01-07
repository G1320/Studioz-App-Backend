import { Request } from 'express';
import { ReservationModel } from '../../models/reservationModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { RESERVATION_STATUS, isReservationExpired, updateExpiredReservations } from '../../services/reservationService.js';
import { emitReservationUpdate, emitAvailabilityUpdate } from '../../webSockets/socket.js';
import { releaseReservationTimeSlots } from '../handlers/bookingHandler.js';
import {
  notifyVendorReservationCancelled,
  notifyCustomerReservationConfirmed,
  notifyBookerReservationCancelled
} from '../../utils/notificationUtils.js';

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
  const { studioId, userId } = req.query;

  // Update expired reservations before fetching
  await updateExpiredReservations();

  let query = ReservationModel.find();
  if (studioId) query = query.where('studioId', studioId);
  if (userId) query = query.where('userId', userId);

  const reservations = await query.exec();
  return reservations;
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

  const previousStatus = reservation.status;
  const previousItemId = reservation.itemId?.toString();

  // Check if fields that affect price are being updated
  const priceAffectingFields = ['addOnIds', 'timeSlots', 'itemPrice'];
  const shouldRecalculatePrice = priceAffectingFields.some(field => req.body[field] !== undefined);

  // Check if availability-affecting fields are being updated
  const availabilityAffectingFields = ['timeSlots', 'bookingDate'];
  const shouldUpdateAvailability = availabilityAffectingFields.some(field => req.body[field] !== undefined);

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

    // Emit availability update if time slots or booking date changed
    if (shouldUpdateAvailability && updatedReservation.itemId) {
      // Emit for both the previous item (if changed) and current item
      emitAvailabilityUpdate(updatedReservation.itemId.toString());
      if (previousItemId && previousItemId !== updatedReservation.itemId.toString()) {
        emitAvailabilityUpdate(previousItemId);
      }
    }

    // Notify customer when status changes to confirmed or cancelled
    if (previousStatus !== updatedReservation.status && bookerId) {
      if (updatedReservation.status === RESERVATION_STATUS.CONFIRMED) {
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

export default {
  createReservation,
  getReservations,
  getReservationsByStudioId,
  getReservationsByPhone,
  getReservationById,
  updateReservationById,
  cancelReservationById,
};