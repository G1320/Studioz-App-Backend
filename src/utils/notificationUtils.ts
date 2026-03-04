import { createNotification, getUnreadCount } from '../services/notificationService.js';
import { emitNotification, emitNotificationCount } from '../webSockets/socket.js';
import { StudioModel } from '../models/studioModel.js';
import { ItemModel } from '../models/itemModel.js';
import { ReservationModel } from '../models/reservationModel.js';
import { UserModel } from '../models/userModel.js';
import { sendHtmlEmail } from '../api/handlers/emailHandler.js';
import { renderEmail } from '../emails/render.js';
import Notification, { NotificationType, NOTIFICATION_TYPE_CATEGORY } from '../types/notification.js';
import { getEffectiveChannels, isInQuietHours } from '../services/notificationPreferencesService.js';
import { enqueuePush } from '../services/notificationQueueService.js';

interface NotificationData {
  reservationId?: string;
  itemId?: string;
  studioId?: string;
  [key: string]: any;
}

/** Structured log helper for notification events */
const notifLog = {
  warn: (event: string, ctx: Record<string, any>, msg?: string) =>
    console.warn(`[Notification:${event}]`, msg || '', JSON.stringify(ctx)),
  error: (event: string, ctx: Record<string, any>, error: unknown) =>
    console.error(`[Notification:${event}]`, JSON.stringify(ctx), error instanceof Error ? error.message : error),
  info: (event: string, ctx: Record<string, any>, msg?: string) =>
    console.log(`[Notification:${event}]`, msg || '', JSON.stringify(ctx)),
};

/**
 * Create a notification and emit it via socket.
 * Priority and category are derived automatically from the type.
 * Respects user notification preferences (in-app is always created).
 */
export const createAndEmitNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: NotificationData,
  actionUrl?: string,
  options?: { groupKey?: string; expiresAt?: Date }
): Promise<Notification> => {
  // Check user preferences
  const category = NOTIFICATION_TYPE_CATEGORY[type] || 'system';
  let channels = { inApp: true, email: true, push: false };
  try {
    channels = await getEffectiveChannels(userId, category);
  } catch (err) {
    notifLog.warn('preferences_fallback', { userId, type, category }, 'Using default channels');
  }

  // Check quiet hours (suppress push/email during quiet hours for non-high-priority)
  let inQuietHours = false;
  try {
    inQuietHours = await isInQuietHours(userId);
  } catch (err) {
    notifLog.warn('quiet_hours_fallback', { userId, type }, 'Could not check quiet hours');
  }

  // In-app is always created
  const notification = await createNotification({
    userId,
    type,
    title,
    message,
    data,
    actionUrl,
    groupKey: options?.groupKey,
    expiresAt: options?.expiresAt,
  });

  // Emit via socket (always, for in-app)
  emitNotification(userId, notification);

  // Update unread count
  const count = await getUnreadCount(userId);
  emitNotificationCount(userId, count);

  // Enqueue push notification if enabled and not in quiet hours
  if (channels.push && !inQuietHours) {
    enqueuePush(
      userId,
      { title, body: message, actionUrl },
      notification._id?.toString()
    );
  }

  // Store channel preferences on the notification for callers to check
  (notification as any)._channels = channels;
  (notification as any)._inQuietHours = inQuietHours;

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
      notifLog.warn('missing_entity', { studioId }, 'Studio or owner not found');
      return;
    }

    // Get item details
    const item = await ItemModel.findById(itemId);
    const itemName = item?.name?.en || 'Item';

    // Get reservation details
    const reservation = await ReservationModel.findById(reservationId);
    if (!reservation) {
      notifLog.warn('missing_entity', { reservationId }, 'Reservation not found');
      return;
    }

    const studioOwner = await UserModel.findById(studio.createdBy);
    if (!studioOwner?.email) {
      notifLog.info('skip_email', { studioId, userId: studio.createdBy?.toString() }, 'No email on studio owner');
    }

    const customerDisplayName = customerName || reservation.customerName || 'A customer';
    const bookingDate = reservation.bookingDate;
    const startTime = reservation.timeSlots[0] || '';
    const duration = `${reservation.timeSlots.length || 1}h`;

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

    // Send email to studio owner
    if (studioOwner?.email) {
      const guestEmail = reservation.customerId ? (await UserModel.findById(reservation.customerId))?.email || '' : '';

      const { html, subject } = await renderEmail('NEW_BOOKING_VENDOR', {
        ownerName: studioOwner.name || 'Studio owner',
        studioName: studio.name?.en || studio.name?.he || 'Your studio',
        customerName: customerDisplayName,
        guestEmail,
        guestPhone: reservation.customerPhone || '',
        serviceName: item?.name?.en || item?.name?.he || 'Experience',
        dateTime: `${bookingDate} ${startTime}`,
        duration,
      });

      await sendHtmlEmail({
        to: [{ email: studioOwner.email, name: studioOwner.name }],
        subject,
        htmlContent: html,
      });
    }
  } catch (error) {
    notifLog.error('vendor_new_reservation', { reservationId, studioId, itemId }, error);
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
      notifLog.warn('missing_entity', { reservationId }, 'Reservation not found');
      return;
    }

    const customer = await UserModel.findById(customerId);
    const studio = await StudioModel.findById(reservation.studioId);
    const item = await ItemModel.findById(reservation.itemId);

    const itemName = reservation.itemName?.en || 'your booking';
    const bookingDate = reservation.bookingDate;
    const startTime = reservation.timeSlots[0] || '';
    const duration = `${reservation.timeSlots.length || 1}h`;

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

    // Send confirmation email to customer
    if (customer?.email) {
      const { html, subject } = await renderEmail('BOOKING_CONFIRMED_CUSTOMER', {
        customerName: customer.name || 'Customer',
        studioName: studio?.name?.en || studio?.name?.he || 'Studio',
        serviceName: item?.name?.en || item?.name?.he || itemName,
        dateTime: `${bookingDate} ${startTime}`,
        duration,
        location: [studio?.city, studio?.address].filter(Boolean).join(' · '),
        totalPaid: `₪${reservation.totalPrice ?? reservation.itemPrice ?? 0}`,
      });

      await sendHtmlEmail({
        to: [{ email: customer.email, name: customer.name }],
        subject,
        htmlContent: html,
      });
    } else {
      notifLog.info('skip_email', { customerId, reservationId }, 'No email on customer');
    }
  } catch (error) {
    notifLog.error('customer_confirmed', { reservationId, customerId }, error);
  }
};

/**
 * Notify the booker when a reservation is cancelled
 */
export const notifyBookerReservationCancelled = async (
  reservationId: string,
  userId: string
): Promise<void> => {
  try {
    const reservation = await ReservationModel.findById(reservationId);
    if (!reservation) {
      notifLog.warn('missing_entity', { reservationId }, 'Reservation not found');
      return;
    }

    const itemName = reservation.itemName?.en || 'your booking';
    const bookingDate = reservation.bookingDate;
    const startTime = reservation.timeSlots?.[0] || '';

    const title = 'Booking Cancelled';
    const message = `Your booking for ${itemName} on ${bookingDate}${startTime ? ` at ${startTime}` : ''} was cancelled`;
    const actionUrl = `/reservations`;

    await createAndEmitNotification(
      userId,
      'reservation_cancelled',
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
    notifLog.error('booker_cancelled', { reservationId, userId }, error);
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
      notifLog.warn('missing_entity', { reservationId }, 'Reservation not found');
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
    notifLog.error('customer_expired', { reservationId, customerId }, error);
  }
};

/**
 * Notify customer when reservation is modified (rescheduled)
 */
export const notifyCustomerReservationModified = async (
  reservationId: string,
  customerId: string,
  previousDate: string,
  newDate: string,
  newTimeSlots: string[]
): Promise<void> => {
  try {
    const reservation = await ReservationModel.findById(reservationId);
    if (!reservation) return;

    const itemName = reservation.itemName?.en || 'your booking';
    const startTime = newTimeSlots[0] || '';

    const title = 'Booking Modified';
    const message = `Your booking for ${itemName} has been rescheduled from ${previousDate} to ${newDate} at ${startTime}`;
    const actionUrl = `/reservations/${reservationId}`;

    await createAndEmitNotification(
      customerId,
      'reservation_modified',
      title,
      message,
      { reservationId, itemId: reservation.itemId.toString(), studioId: reservation.studioId?.toString() },
      actionUrl
    );
  } catch (error) {
    notifLog.error('customer_modified', { reservationId, customerId }, error);
  }
};

/**
 * Notify vendor when reservation is modified (rescheduled)
 */
export const notifyVendorReservationModified = async (
  reservationId: string,
  studioId: string,
  previousDate: string,
  newDate: string,
  newTimeSlots: string[],
  customerName?: string
): Promise<void> => {
  try {
    const studio = await StudioModel.findById(studioId);
    if (!studio || !studio.createdBy) return;

    const reservation = await ReservationModel.findById(reservationId);
    const item = await ItemModel.findById(reservation?.itemId);
    const itemName = item?.name?.en || 'Item';
    const customerDisplayName = customerName || reservation?.customerName || 'A customer';
    const startTime = newTimeSlots[0] || '';

    const title = 'Booking Modified';
    const message = `${customerDisplayName} rescheduled ${itemName} from ${previousDate} to ${newDate} at ${startTime}`;
    const actionUrl = `/reservations/${reservationId}`;

    await createAndEmitNotification(
      studio.createdBy.toString(),
      'reservation_modified',
      title,
      message,
      { reservationId, itemId: reservation?.itemId.toString(), studioId },
      actionUrl
    );
  } catch (error) {
    notifLog.error('vendor_modified', { reservationId, studioId }, error);
  }
};

/**
 * Notify a user with a reservation reminder (in-app alongside email)
 */
export const notifyReservationReminder = async (
  reservationId: string,
  userId: string,
  itemName: string,
  bookingDate: string,
  startTime: string,
  hoursUntil: number
): Promise<void> => {
  try {
    const title = 'Booking Reminder';
    const message = hoursUntil <= 2
      ? `Your booking for ${itemName} is in ${hoursUntil} hours — ${bookingDate} at ${startTime}`
      : `Reminder: ${itemName} tomorrow at ${startTime}`;
    const actionUrl = `/reservations/${reservationId}`;

    await createAndEmitNotification(
      userId,
      'reservation_reminder',
      title,
      message,
      { reservationId },
      actionUrl
    );
  } catch (error) {
    notifLog.error('reservation_reminder', { reservationId, userId }, error);
  }
};

/**
 * Send a system alert notification to a specific user
 */
export const notifySystemAlert = async (
  userId: string,
  title: string,
  message: string,
  actionUrl?: string
): Promise<void> => {
  try {
    await createAndEmitNotification(userId, 'system_alert', title, message, {}, actionUrl);
  } catch (error) {
    notifLog.error('system_alert', { userId }, error);
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
      notifLog.warn('missing_entity', { studioId }, 'Studio or owner not found for cancel notification');
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
    notifLog.error('vendor_cancelled', { reservationId, studioId, itemId }, error);
  }
};

