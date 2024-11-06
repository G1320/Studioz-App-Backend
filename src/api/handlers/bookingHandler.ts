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

const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);


const reserveItemTimeSlots = handleRequest(async (req: Request) => {
    const { itemId, bookingDate, startTime, hours } = req.body;

    const item = await ItemModel.findOne({ _id: itemId });
    if (!item) throw new ExpressError('Item not found', 404);

    // Initialize availability
    item.availability = initializeAvailability(item.availability) ;
        
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
    console.log('item availability before: ', item?.availability);
    if (!item) throw new ExpressError('Item not found', 404);

    // Initialize availability if necessary
    item.availability = initializeAvailability(item.availability);

    // Find or create the availability entry for the specified date
    const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, defaultHours);

    // Generate all time slots for the day starting from `startTime` for the item duration
    const allBookedSlots = generateTimeSlots(startTime, hours);

    // Calculate the slots to keep booked (first `hours` slots)
    const slotsToRemainBooked = allBookedSlots.slice(0, hours);

    // Determine which slots to release (slots after `hours`)
    const slotsToRelease = allBookedSlots.slice(hours);

    // Update `dateAvailability.times` by adding back only the released slots
    dateAvailability.times = addTimeSlots(dateAvailability.times, slotsToRelease);

    // Remove any duplicate entries
    dateAvailability.times = Array.from(new Set(dateAvailability.times));

    // Sort times to maintain chronological order
    dateAvailability.times.sort((a: string, b: string) => parseInt(a.split(':')[0]) - parseInt(b.split(':')[0]));

    // Update item.availability with the modified dateAvailability
    item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
    );

    console.log('item availability after: ', item?.availability);

    await item.save();

    return item;
});



export default {
    reserveItemTimeSlots,
    releaseItemTimeSlots,
};
