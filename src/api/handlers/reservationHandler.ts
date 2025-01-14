import { Request } from 'express';
import { ReservationModel } from '../../models/reservationModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { ItemModel } from '../../models/itemModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { RESERVATION_STATUS, isReservationExpired, updateExpiredReservations } from '../../utils/reservationUtils.js';

const createReservation = handleRequest(async (req: Request) => {
  const { studioId, itemId, userId, reservationDetails } = req.body;

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

  const reservation = new ReservationModel({
    studioId,
    itemId,
    itemName: item.name,
    userId,
    reservationDetails,
    status: RESERVATION_STATUS.PENDING,
    expiration: expirationTime
  });

  await reservation.save();
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

  const updatedReservation = await ReservationModel.findByIdAndUpdate(
    reservationId,
    req.body,
    { new: true }
  );
  
  return updatedReservation;
});

const deleteReservationById = handleRequest(async (req: Request) => {
  const { reservationId } = req.params;
  if (!reservationId) throw new ExpressError('Reservation ID not provided', 400);

  const deletedReservation = await ReservationModel.findByIdAndDelete(reservationId);
  if (!deletedReservation) throw new ExpressError('Reservation not found', 404);

  return deletedReservation;
});

export default {
  createReservation,
  getReservations,
  getReservationsByStudioId,
  getReservationById,
  updateReservationById,
  deleteReservationById,
};