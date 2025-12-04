import { createNotification, getUnreadCount } from '../services/notificationService.js';
import { emitNotification, emitNotificationCount } from '../webSockets/socket.js';
import { StudioModel } from '../models/studioModel.js';
import { ItemModel } from '../models/itemModel.js';
import { ReservationModel } from '../models/reservationModel.js';
import Notification, { NotificationType } from '../types/notification.js';

interface NotificationData {
  reservationId?: string;
  itemId?: string;
  studioId?: string;
  [key: string]: any;
}

/**
 * Create a notification and emit it via socket
 */
export const createAndEmitNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: NotificationData,
  actionUrl?: string
): Promise<Notification> => {
  // Create notification in database
  const notification = await createNotification({
    userId,
    type,
    title,
    message,
    data,
    actionUrl,
    priority: type === 'new_reservation' || type === 'reservation_confirmed' ? 'high' : 'medium'
  });

  // Emit via socket
  emitNotification(userId, notification);

  // Update unread count
  const count = await getUnreadCount(userId);
  emitNotificationCount(userId, count);

  return notification;
};

/**
 * Notify vendor when a new reservation is created
 */
export const notifyVendorNewReservation = async (
  reservationId: string,
  studioId: string,
  itemId: string,
  customerName?: string
): Promise<void> => {
  try {
    // Find studio owner
    const studio = await StudioModel.findById(studioId);
    if (!studio || !studio.createdBy) {
      console.log('Studio or studio owner not found for notification');
      return;
    }

    // Get item details
    const item = await ItemModel.findById(itemId);
    const itemName = item?.name?.en || 'Item';

    // Get reservation details
    const reservation = await ReservationModel.findById(reservationId);
    if (!reservation) {
      console.log('Reservation not found for notification');
      return;
    }

    const customerDisplayName = customerName || reservation.customerName || 'A customer';
    const bookingDate = reservation.bookingDate;
    const startTime = reservation.timeSlots[0] || '';

    const title = 'New Booking';
    const message = `${customerDisplayName} booked ${itemName} on ${bookingDate} at ${startTime}`;
    const actionUrl = `/reservations/${reservationId}`;

    await createAndEmitNotification(
      studio.createdBy.toString(),
      'new_reservation',
      title,
      message,
      {
        reservationId,
        itemId,
        studioId
      },
      actionUrl
    );
  } catch (error) {
    console.error('Error notifying vendor of new reservation:', error);
  }
};

/**
 * Notify customer when reservation is confirmed
 */
export const notifyCustomerReservationConfirmed = async (
  reservationId: string,
  customerId: string
): Promise<void> => {
  try {
    const reservation = await ReservationModel.findById(reservationId);
    if (!reservation) {
      console.log('Reservation not found for notification');
      return;
    }

    const itemName = reservation.itemName?.en || 'your booking';
    const bookingDate = reservation.bookingDate;
    const startTime = reservation.timeSlots[0] || '';

    const title = 'Booking Confirmed';
    const message = `Your booking for ${itemName} on ${bookingDate} at ${startTime} is confirmed`;
    const actionUrl = `/reservations/${reservationId}`;

    await createAndEmitNotification(
      customerId,
      'reservation_confirmed',
      title,
      message,
      {
        reservationId,
        itemId: reservation.itemId.toString(),
        studioId: reservation.studioId.toString()
      },
      actionUrl
    );
  } catch (error) {
    console.error('Error notifying customer of confirmed reservation:', error);
  }
};

/**
 * Notify customer when reservation expires
 */
export const notifyCustomerReservationExpired = async (
  reservationId: string,
  customerId: string
): Promise<void> => {
  try {
    const reservation = await ReservationModel.findById(reservationId);
    if (!reservation) {
      console.log('Reservation not found for notification');
      return;
    }

    const itemName = reservation.itemName?.en || 'your booking';
    const bookingDate = reservation.bookingDate;

    const title = 'Booking Expired';
    const message = `Your reservation for ${itemName} on ${bookingDate} has expired`;
    const actionUrl = `/reservations`;

    await createAndEmitNotification(
      customerId,
      'reservation_expired',
      title,
      message,
      {
        reservationId,
        itemId: reservation.itemId.toString(),
        studioId: reservation.studioId.toString()
      },
      actionUrl
    );
  } catch (error) {
    console.error('Error notifying customer of expired reservation:', error);
  }
};

/**
 * Notify vendor when reservation is cancelled
 */
export const notifyVendorReservationCancelled = async (
  reservationId: string,
  studioId: string,
  itemId: string,
  customerName?: string
): Promise<void> => {
  try {
    const studio = await StudioModel.findById(studioId);
    if (!studio || !studio.createdBy) {
      console.log('Studio or studio owner not found for notification');
      return;
    }

    const item = await ItemModel.findById(itemId);
    const itemName = item?.name?.en || 'Item';

    const reservation = await ReservationModel.findById(reservationId);
    const customerDisplayName = customerName || reservation?.customerName || 'A customer';
    const bookingDate = reservation?.bookingDate || '';

    const title = 'Booking Cancelled';
    const message = `${customerDisplayName} cancelled booking for ${itemName} on ${bookingDate}`;
    const actionUrl = `/reservations`;

    await createAndEmitNotification(
      studio.createdBy.toString(),
      'reservation_cancelled',
      title,
      message,
      {
        reservationId,
        itemId,
        studioId
      },
      actionUrl
    );
  } catch (error) {
    console.error('Error notifying vendor of cancelled reservation:', error);
  }
};

