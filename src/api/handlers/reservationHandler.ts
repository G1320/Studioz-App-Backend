import { Request } from 'express';
import { ReservationModel } from '../../models/reservationModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { RESERVATION_STATUS, isReservationExpired, updateExpiredReservations } from '../../services/reservationService.js';
import { emitReservationUpdate } from '../../webSockets/socket.js';
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

  const updatedReservation = await ReservationModel.findByIdAndUpdate(
    reservationId,
    req.body,
    { new: true }
  );
  
  if (updatedReservation) {
    const bookerId = updatedReservation.customerId?.toString() || updatedReservation.userId?.toString() || '';

    emitReservationUpdate(
      [updatedReservation._id.toString()],
      bookerId
    );

    // Notify customer when status changes to confirmed or cancelled
    if (previousStatus !== updatedReservation.status && bookerId) {
      if (updatedReservation.status === RESERVATION_STATUS.CONFIRMED) {
        await notifyCustomerReservationConfirmed(
          updatedReservation._id.toString(),
          bookerId
        );
      } else if (updatedReservation.status === RESERVATION_STATUS.CANCELLED) {
        await notifyBookerReservationCancelled(
          updatedReservation._id.toString(),
          bookerId
        );
      }
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

  // Notify vendor of the cancellation
  if (reservation.studioId) {
    await notifyVendorReservationCancelled(
      reservation._id.toString(),
      reservation.studioId.toString(),
      reservation.itemId.toString(),
      reservation.customerName
    );
  }

  // Notify customer of the cancellation
  const bookerId = reservation.customerId?.toString() || reservation.userId?.toString() || '';
  if (bookerId) {
    await notifyBookerReservationCancelled(
      reservation._id.toString(),
      bookerId
    );
  }

  emitReservationUpdate(
    [reservation._id.toString()],
    reservation.customerId?.toString() || reservation.userId?.toString() || ''
  );

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
};