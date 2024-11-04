import { Request } from 'express';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { ItemModel } from '../../models/itemModel.js';
import {
    initializeAvailability,
    findOrCreateDateAvailability,
    generateTimeSlots,
    areAllSlotsAvailable,
    removeTimeSlots,
    addTimeSlots
} from '../../utils/timeSlotUtils.js';

const reserveItemTimeSlots = handleRequest(async (req: Request) => {
    const { itemId, bookingDate, startTime, hours } = req.body;

    const item = await ItemModel.findOne({ _id: itemId });
    if (!item) throw new ExpressError('Item not found', 404);

    // Initialize availability
    item.availability = initializeAvailability(item.availability) ;
    
    // Define default hours for availability
    const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    
    // Find or create availability entry for the booking date
    const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, defaultHours);

    // Generate array of consecutive time slots needed
    const timeSlots = generateTimeSlots(startTime, hours);

    // Verify all needed time slots are available
    if (!areAllSlotsAvailable(timeSlots, dateAvailability.times)) {
        throw new ExpressError('One or more requested time slots are not available', 400);
    }

    // Remove all selected time slots
    dateAvailability.times = removeTimeSlots(dateAvailability.times, timeSlots);

    // Update item.availability with the modified dateAvailability
    item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
    );

    await item.save();

    return item;
});

const releaseItemTimeSlots = handleRequest(async (req: Request) => {
    const { itemId, bookingDate, startTime, hours } = req.body;

    const item = await ItemModel.findOne({ _id: itemId });
    if (!item) throw new ExpressError('Item not found', 404);

    // Initialize availability
    item.availability = initializeAvailability(item.availability);
    
    // Define default hours for availability
    const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    
    // Find or create availability entry for the booking date
    const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, defaultHours);

    // Generate array of consecutive time slots needed
    const timeSlots = generateTimeSlots(startTime, hours);

    // Add the time slots back to availability
    dateAvailability.times = addTimeSlots(dateAvailability.times, timeSlots);

    // Update item.availability with the modified dateAvailability
    item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
    );

    await item.save();

    return item;
});

export default {
    releaseItemTimeSlots,
    reserveItemTimeSlots,
};
