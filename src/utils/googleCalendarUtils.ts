import Reservation from '../types/reservation.js';
import Studio from '../types/studio.js';
import Item from '../types/item.js';
import { calendar_v3 } from 'googleapis';

/**
 * Parse time slots to start and end datetime
 * @param bookingDate - Date string in DD/MM/YYYY format
 * @param timeSlots - Array of time slots in HH:00 format (e.g., ["09:00", "10:00", "11:00"])
 * @returns Start and end Date objects
 */
export const parseTimeSlotsToDateTime = (
  bookingDate: string,
  timeSlots: string[]
): { start: Date; end: Date } => {
  if (!timeSlots || timeSlots.length === 0) {
    throw new Error('Time slots are required');
  }

  // Parse booking date (DD/MM/YYYY format)
  const [day, month, year] = bookingDate.split('/').map(Number);
  if (!day || !month || !year) {
    throw new Error(`Invalid booking date format: ${bookingDate}. Expected DD/MM/YYYY`);
  }

  // Get first time slot for start time
  const startTimeSlot = timeSlots[0];
  const [startHour, startMinute] = startTimeSlot.split(':').map(Number);

  // Calculate end time (last slot + 1 hour)
  const lastTimeSlot = timeSlots[timeSlots.length - 1];
  const [lastHour, lastMinute] = lastTimeSlot.split(':').map(Number);
  const endHour = lastHour + 1; // Each slot is 1 hour

  // Create Date objects (month is 0-indexed in JavaScript Date)
  const start = new Date(year, month - 1, day, startHour, startMinute || 0);
  const end = new Date(year, month - 1, day, endHour, lastMinute || 0);

  return { start, end };
};

/**
 * Build event description from reservation details
 * @param reservation - The reservation object
 * @param item - The item object (optional)
 * @returns Formatted description string
 */
export const buildEventDescription = (
  reservation: Reservation,
  item?: Item
): string => {
  const parts: string[] = [];

  // Customer information
  if (reservation.customerName) {
    parts.push(`Customer: ${reservation.customerName}`);
  }
  if (reservation.customerPhone) {
    parts.push(`Phone: ${reservation.customerPhone}`);
  }

  // Item details
  const itemName = reservation.itemName?.en || item?.name?.en || 'Unknown Item';
  parts.push(`Item: ${itemName}`);

  // Booking details
  parts.push(`Date: ${reservation.bookingDate}`);
  parts.push(`Time: ${reservation.timeSlots[0]} - ${reservation.timeSlots[reservation.timeSlots.length - 1]}`);
  parts.push(`Duration: ${reservation.timeSlots.length} hour${reservation.timeSlots.length > 1 ? 's' : ''}`);

  // Price information
  if (reservation.totalPrice) {
    parts.push(`Total: ₪${reservation.totalPrice}`);
  }

  // Comment
  if (reservation.comment) {
    parts.push(`\nNotes: ${reservation.comment}`);
  }

  // Reservation ID for reference
  parts.push(`\nReservation ID: ${reservation._id}`);

  return parts.join('\n');
};

/**
 * Format reservation to Google Calendar event
 * @param reservation - The reservation object
 * @param studio - The studio object
 * @param item - The item object (optional)
 * @returns Google Calendar event object
 */
export const formatReservationToCalendarEvent = (
  reservation: Reservation,
  studio: Studio,
  item?: Item
): calendar_v3.Schema$Event => {
  const { start, end } = parseTimeSlotsToDateTime(reservation.bookingDate, reservation.timeSlots);

  // Format event title
  const studioName = studio.name?.en || 'Studio';
  const itemName = reservation.itemName?.en || item?.name?.en || 'Item';
  const title = `${studioName} - ${itemName}`;

  // Format description
  const description = buildEventDescription(reservation, item);

  // Format location
  const location = studio.address || studio.city || '';

  // Create event object
  const event: calendar_v3.Schema$Event = {
    summary: title,
    description: description,
    start: {
      dateTime: start.toISOString(),
      timeZone: 'Asia/Jerusalem' // Israel timezone
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: 'Asia/Jerusalem'
    },
    location: location
  };

  // Add customer email as attendee if available
  // Note: We'd need to fetch customer email from User model if needed
  // For now, we'll skip this to keep it simple

  return event;
};

