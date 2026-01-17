import { ReservationModel } from '../models/reservationModel.js';
import { ItemModel } from '../models/itemModel.js';
import { StudioModel } from '../models/studioModel.js';
import { UserModel } from '../models/userModel.js';
import { sendBookingReminder } from '../api/handlers/emailHandler.js';
import { shouldSendEmail } from './emailPreferencesService.js';

/**
 * Parse booking date string (DD/MM/YYYY) to Date object
 */
const parseBookingDate = (dateStr: string): Date => {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(dateStr);
};

/**
 * Format time slots for display (e.g., "10:00 - 12:00")
 */
const formatTimeSlots = (timeSlots: string[]): string => {
  if (!timeSlots || timeSlots.length === 0) return '';

  const sorted = [...timeSlots].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Add 1 hour to last slot to show end time
  const lastHour = parseInt(last.split(':')[0]) + 1;
  const endTime = `${lastHour.toString().padStart(2, '0')}:00`;

  return `${first} - ${endTime}`;
};

/**
 * Get bookings happening in the next N hours
 * Used to send reminder emails
 */
export const getUpcomingBookings = async (hoursAhead: number = 24) => {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  // Format dates for comparison
  const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = `${String(tomorrowDate.getDate()).padStart(2, '0')}/${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}/${tomorrowDate.getFullYear()}`;

  // Find confirmed reservations for today or tomorrow
  const reservations = await ReservationModel.find({
    status: 'confirmed',
    bookingDate: { $in: [todayStr, tomorrowStr] },
    // Exclude reservations we've already reminded
    reminderSent: { $ne: true }
  });

  // Filter to only include bookings within the time window
  const upcomingBookings = reservations.filter(res => {
    const bookingDate = parseBookingDate(res.bookingDate);
    const firstSlot = res.timeSlots?.[0];

    if (!firstSlot) return false;

    // Parse the first time slot to get the booking start time
    const [hours, minutes] = firstSlot.split(':').map(Number);
    bookingDate.setHours(hours, minutes || 0, 0, 0);

    // Check if booking is in the future and within the reminder window
    return bookingDate > now && bookingDate <= cutoffDate;
  });

  return upcomingBookings;
};

/**
 * Send reminder emails for upcoming bookings
 * Called by the scheduler
 */
export const sendBookingReminders = async (hoursAhead: number = 24): Promise<number> => {
  let sentCount = 0;

  try {
    const upcomingBookings = await getUpcomingBookings(hoursAhead);

    if (upcomingBookings.length === 0) {
      console.log('No upcoming bookings to remind');
      return 0;
    }

    console.log(`Found ${upcomingBookings.length} bookings to remind`);

    // Process each booking
    for (const reservation of upcomingBookings) {
      try {
        // Get customer info
        const customerId = reservation.customerId || reservation.userId;
        let customerEmail = '';
        let customerName = reservation.customerName || 'Customer';

        if (customerId) {
          const customer = await UserModel.findById(customerId).select('email name emailPreferences');
          if (customer) {
            customerEmail = customer.email || '';
            customerName = customer.name || customerName;

            // Check if user wants to receive booking reminders
            const shouldSend = await shouldSendEmail(customerId.toString(), 'bookingReminders');
            if (!shouldSend) {
              console.log(`Skipping reminder for ${customerEmail} - user disabled booking reminders`);
              // Mark as sent so we don't keep trying
              await ReservationModel.findByIdAndUpdate(reservation._id, { reminderSent: true });
              continue;
            }
          }
        }

        // Skip if no email
        if (!customerEmail) {
          console.log(`Skipping reminder for reservation ${reservation._id} - no customer email`);
          continue;
        }

        // Get item and studio details
        const item = await ItemModel.findById(reservation.itemId).select('name');
        const studio = await StudioModel.findById(reservation.studioId).select('name address');

        const itemName = typeof item?.name === 'object'
          ? (item.name.he || item.name.en || 'Service')
          : (item?.name || 'Service');

        const studioName = typeof studio?.name === 'object'
          ? (studio.name.he || studio.name.en || 'Studio')
          : (studio?.name || 'Studio');

        // Calculate hours until booking
        const bookingDate = parseBookingDate(reservation.bookingDate);
        const firstSlot = reservation.timeSlots?.[0];
        if (firstSlot) {
          const [hours] = firstSlot.split(':').map(Number);
          bookingDate.setHours(hours, 0, 0, 0);
        }
        const hoursUntil = Math.round((bookingDate.getTime() - Date.now()) / (1000 * 60 * 60));

        // Send reminder email
        await sendBookingReminder(
          customerEmail,
          {
            bookingId: reservation._id.toString(),
            customerName,
            studioName,
            serviceName: itemName,
            dateTime: `${reservation.bookingDate} ${formatTimeSlots(reservation.timeSlots)}`,
            duration: `${reservation.timeSlots.length} שעות`,
            location: reservation.address || studio?.address || '',
            totalPaid: `₪${reservation.totalPrice || 0}`
          },
          hoursUntil
        );

        // Mark reminder as sent
        await ReservationModel.findByIdAndUpdate(reservation._id, { reminderSent: true });

        sentCount++;
        console.log(`Sent reminder to ${customerEmail} for reservation ${reservation._id}`);

      } catch (error) {
        console.error(`Error sending reminder for reservation ${reservation._id}:`, error);
        // Continue with next reservation
      }
    }

    console.log(`Sent ${sentCount} booking reminders`);
    return sentCount;

  } catch (error) {
    console.error('Error in sendBookingReminders:', error);
    throw error;
  }
};

/**
 * Reset reminder flags for past bookings (cleanup)
 * This allows re-sending reminders if a booking is rescheduled
 */
export const resetPastReminderFlags = async (): Promise<void> => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayStr = `${String(yesterday.getDate()).padStart(2, '0')}/${String(yesterday.getMonth() + 1).padStart(2, '0')}/${yesterday.getFullYear()}`;

  // This is a simple approach - in production you might want more sophisticated date comparison
  await ReservationModel.updateMany(
    {
      reminderSent: true,
      bookingDate: { $lt: yesterdayStr }
    },
    { $unset: { reminderSent: '' } }
  );
};

export default {
  getUpcomingBookings,
  sendBookingReminders,
  resetPastReminderFlags
};
