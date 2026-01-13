import { ItemModel } from '../models/itemModel.js';
import { StudioModel } from '../models/studioModel.js';
import { emitAvailabilityUpdate } from '../webSockets/socket.js';
import {
  initializeAvailability,
  findOrCreateDateAvailability,
  removeTimeSlots,
  addTimeSlots,
  areAllSlotsAvailable,
  generateHoursFromTimeRanges,
  DEFAULT_HOURS
} from '../utils/timeSlotUtils.js';

/**
 * Get operating hours for a studio
 * Returns the studio's configured hours or default 24-hour availability
 */
export const getStudioOperatingHours = async (studioId: string | undefined): Promise<string[]> => {
  if (!studioId) return DEFAULT_HOURS;
  
  const studio = await StudioModel.findById(studioId);
  return generateHoursFromTimeRanges(studio?.studioAvailability?.times);
};

/**
 * Release time slots back to availability for an item
 */
export const releaseItemTimeSlots = async (
  itemId: string,
  bookingDate: string,
  timeSlots: string[],
  studioHours?: string[]
): Promise<void> => {
  const item = await ItemModel.findById(itemId);
  if (!item) return;

  const hours = studioHours || await getStudioOperatingHours(item.studioId?.toString());
  
  item.availability = initializeAvailability(item.availability);
  const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, hours);
  dateAvailability.times = addTimeSlots(dateAvailability.times, timeSlots);
  
  item.availability = item.availability.map(avail =>
    avail.date === bookingDate ? dateAvailability : avail
  );
  
  await item.save();
  emitAvailabilityUpdate(item._id.toString());
};

/**
 * Reserve time slots from availability for an item
 * Returns true if successful, false if slots not available
 */
export const reserveItemTimeSlots = async (
  itemId: string,
  bookingDate: string,
  timeSlots: string[],
  studioHours?: string[]
): Promise<boolean> => {
  const item = await ItemModel.findById(itemId);
  if (!item) return false;

  // Check if item is disabled
  if (item.active === false) return false;

  // Check if studio is disabled
  if (item.studioId) {
    const studio = await StudioModel.findById(item.studioId);
    if (studio && studio.active === false) return false;
  }

  const hours = studioHours || await getStudioOperatingHours(item.studioId?.toString());
  
  item.availability = initializeAvailability(item.availability);
  const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, hours);
  
  // Check if slots are available
  if (!areAllSlotsAvailable(timeSlots, dateAvailability.times)) {
    return false;
  }
  
  dateAvailability.times = removeTimeSlots(dateAvailability.times, timeSlots);
  
  item.availability = item.availability.map(avail =>
    avail.date === bookingDate ? dateAvailability : avail
  );
  
  await item.save();
  emitAvailabilityUpdate(item._id.toString());
  return true;
};

/**
 * Check if time slots are available for an item (without modifying)
 */
export const checkSlotsAvailable = async (
  itemId: string,
  bookingDate: string,
  timeSlots: string[],
  studioHours?: string[]
): Promise<boolean> => {
  const item = await ItemModel.findById(itemId);
  if (!item) return false;

  // Check if item is disabled
  if (item.active === false) return false;

  // Check if studio is disabled
  if (item.studioId) {
    const studio = await StudioModel.findById(item.studioId);
    if (studio && studio.active === false) return false;
  }

  const hours = studioHours || await getStudioOperatingHours(item.studioId?.toString());
  
  const availability = initializeAvailability(item.availability);
  const dateAvailability = findOrCreateDateAvailability(availability, bookingDate, hours);
  
  return areAllSlotsAvailable(timeSlots, dateAvailability.times);
};

/**
 * Release time slots for all items in a studio
 */
export const releaseStudioWideTimeSlots = async (
  studioId: string,
  bookingDate: string,
  timeSlots: string[],
  excludeItemId?: string
): Promise<void> => {
  const studioHours = await getStudioOperatingHours(studioId);
  const query: any = { studioId };
  if (excludeItemId) {
    query._id = { $ne: excludeItemId };
  }
  
  const studioItems = await ItemModel.find(query);
  
  for (const item of studioItems) {
    item.availability = initializeAvailability(item.availability);
    const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, studioHours);
    dateAvailability.times = addTimeSlots(dateAvailability.times, timeSlots);
    
    item.availability = item.availability.map(avail =>
      avail.date === bookingDate ? dateAvailability : avail
    );
    
    await item.save();
    emitAvailabilityUpdate(item._id.toString());
  }
};

/**
 * Reserve time slots for all items in a studio
 */
export const reserveStudioWideTimeSlots = async (
  studioId: string,
  bookingDate: string,
  timeSlots: string[],
  excludeItemId?: string
): Promise<void> => {
  const studioHours = await getStudioOperatingHours(studioId);
  const query: any = { studioId };
  if (excludeItemId) {
    query._id = { $ne: excludeItemId };
  }
  
  const studioItems = await ItemModel.find(query);
  
  for (const item of studioItems) {
    item.availability = initializeAvailability(item.availability);
    const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, studioHours);
    dateAvailability.times = removeTimeSlots(dateAvailability.times, timeSlots);
    
    item.availability = item.availability.map(avail =>
      avail.date === bookingDate ? dateAvailability : avail
    );
    
    await item.save();
    emitAvailabilityUpdate(item._id.toString());
  }
};

/**
 * Update reservation time slots - releases old slots and reserves new ones
 * Handles both the main item and all other items in the studio
 */
export const updateReservationAvailability = async (
  itemId: string,
  studioId: string | undefined,
  oldDate: string,
  oldSlots: string[],
  newDate: string,
  newSlots: string[]
): Promise<{ success: boolean; error?: string }> => {
  const studioHours = await getStudioOperatingHours(studioId);
  const item = await ItemModel.findById(itemId);
  
  if (!item) {
    return { success: false, error: 'Item not found' };
  }

  // Initialize availability
  item.availability = initializeAvailability(item.availability);

  // 1. RELEASE OLD TIME SLOTS
  const oldDateAvailability = findOrCreateDateAvailability(item.availability, oldDate, studioHours);
  oldDateAvailability.times = addTimeSlots(oldDateAvailability.times, oldSlots);
  item.availability = item.availability.map(avail =>
    avail.date === oldDate ? oldDateAvailability : avail
  );

  // 2. VALIDATE NEW TIME SLOTS ARE AVAILABLE
  const newDateAvailability = findOrCreateDateAvailability(item.availability, newDate, studioHours);
  if (!areAllSlotsAvailable(newSlots, newDateAvailability.times)) {
    return { success: false, error: 'One or more requested time slots are no longer available' };
  }

  // 3. RESERVE NEW TIME SLOTS
  newDateAvailability.times = removeTimeSlots(newDateAvailability.times, newSlots);
  item.availability = item.availability.map(avail =>
    avail.date === newDate ? newDateAvailability : avail
  );

  await item.save();
  emitAvailabilityUpdate(item._id.toString());

  // 4. UPDATE OTHER STUDIO ITEMS
  if (studioId) {
    // Release old slots from other items
    await releaseStudioWideTimeSlots(studioId, oldDate, oldSlots, itemId);
    // Reserve new slots on other items
    await reserveStudioWideTimeSlots(studioId, newDate, newSlots, itemId);
  }

  return { success: true };
};
