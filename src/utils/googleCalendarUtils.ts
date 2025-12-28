import Reservation from '../types/reservation.js';
import Studio from '../types/studio.js';
import Item from '../types/item.js';
import { calendar_v3 } from 'googleapis';

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
  // Parse booking date (DD/MM/YYYY format)
  const [day, month, year] = reservation.bookingDate.split('/').map(Number);
  
  // Get start time
  const startTimeSlot = reservation.timeSlots[0];
  const [startHour, startMinute] = startTimeSlot.split(':').map(Number);
  
  // Calculate end time
  const lastTimeSlot = reservation.timeSlots[reservation.timeSlots.length - 1];
  const [lastHour, lastMinute] = lastTimeSlot.split(':').map(Number);
  const endHour = lastHour + 1; // Each slot is 1 hour
  
  // Format as ISO string without timezone (YYYY-MM-DDTHH:mm:ss)
  // This ensures Google Calendar interprets it in the specified timeZone
  const formatDateTime = (y: number, m: number, d: number, h: number, min: number) => {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
  };
  
  const startDateTime = formatDateTime(year, month, day, startHour, startMinute || 0);
  const endDateTime = formatDateTime(year, month, day, endHour, lastMinute || 0);

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
      dateTime: startDateTime,
      timeZone: 'Asia/Jerusalem' // Israel timezone
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'Asia/Jerusalem'
    },
    location: location
  };

  return event;
};

/**
 * Parse Google Calendar event datetime to booking date and time slots
 * @param eventStart - Event start datetime (ISO string or Date object)
 * @param eventEnd - Event end datetime (ISO string or Date object)
 * @returns Object with bookingDate (DD/MM/YYYY) and timeSlots array
 */
export const parseCalendarEventToTimeSlots = (
  eventStart: string | Date,
  eventEnd: string | Date
): { bookingDate: string; timeSlots: string[] } => {
  const start = typeof eventStart === 'string' ? new Date(eventStart) : eventStart;
  const end = typeof eventEnd === 'string' ? new Date(eventEnd) : eventEnd;

  // Use Intl.DateTimeFormat to get date/time parts in Israel timezone
  const israelTz = 'Asia/Jerusalem';
  const dateFormatter = new Intl.DateTimeFormat('en-GB', { 
    timeZone: israelTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Helper to get parts map
  const getParts = (date: Date) => {
    const parts = dateFormatter.formatToParts(date);
    const map: Record<string, string> = {};
    parts.forEach(p => map[p.type] = p.value);
    return map;
  };

  const startParts = getParts(start);
  const bookingDate = `${startParts.day}/${startParts.month}/${startParts.year}`;

  // Calculate duration in hours
  const durationMs = end.getTime() - start.getTime();
  const durationHours = Math.ceil(durationMs / (1000 * 60 * 60)); // Round up to nearest hour

  // Generate time slots starting from the event start hour (in Israel time)
  const startHour = parseInt(startParts.hour, 10);
  const timeSlots: string[] = [];
  for (let i = 0; i < durationHours; i++) {
    const hour = (startHour + i) % 24;
    timeSlots.push(`${String(hour).padStart(2, '0')}:00`);
  }

  return { bookingDate, timeSlots };
};

/**
 * Check if a calendar event should block studio time slots
 * Events created by the app (with reservation ID in description) should be ignored
 * @param event - Google Calendar event
 * @returns true if the event should block time slots
 */
export const shouldBlockTimeSlotsForEvent = (event: calendar_v3.Schema$Event): boolean => {
  // If event has a description with "Reservation ID:", it was created by our app
  // We should ignore these to avoid double-blocking
  if (event.description && event.description.includes('Reservation ID:')) {
    return false;
  }

  // Block time slots for all other events
  return true;
};

