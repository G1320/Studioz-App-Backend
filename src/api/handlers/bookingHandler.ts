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
import { emitAvailabilityUpdate } from '../../webSockets/socket.js';
import { ReservationModel } from '../../models/reservationModel.js';


const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);


const reserveItemTimeSlots = handleRequest(async (req: Request) => {
    const { itemId, bookingDate, startTime, hours } = req.body;
    console.log('hours: ', hours);

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
    const expiration = new Date(Date.now() + 15 * 60 * 1000); // 15-minute hold
    const reservation = new ReservationModel({
      itemId,
      bookingDate,
      timeSlots,
      expiration,
      itemPrice: item.price||0,
    });
    
    // Remove all selected time slots
    dateAvailability.times = removeTimeSlots(dateAvailability.times, timeSlots);
    
    // Update item.availability with the modified dateAvailability
    item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
        );
        
    await reservation.save();
    await item.save();
    emitAvailabilityUpdate(itemId);

    return item;
});

export const reserveNextItemTimeSlot = handleRequest(async (req: Request) => {
    const { itemId, bookingDate, startTime, hours } = req.body;

    const item = await ItemModel.findOne({ _id: itemId });
    if (!item) throw new ExpressError('Item not found', 404);

    // Initialize availability if needed
    item.availability = initializeAvailability(item.availability);

    // Find or create the availability entry for the specified date
    const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, defaultHours);

    // Generate all booked time slots for the current quantity (e.g., `11:00`, `12:00` for 2 hours)
    const currentSlots = generateTimeSlots(startTime, hours);
    const lastBookedSlot = currentSlots[currentSlots.length - 2]; // Get the last booked slot
    const lastBookedHour = parseInt(lastBookedSlot.split(':')[0]);

    // Calculate the next hour to book
    const nextHour = String(lastBookedHour + 1).padStart(2, '0') + ':00';
    const nextSlot = generateTimeSlots(nextHour, 1); // Only generate the next single hour slot

    // Check if the next slot is available
    if (!areAllSlotsAvailable(nextSlot, dateAvailability.times)) {
        throw new ExpressError('The next requested time slot is not available', 400);
    }

    // Reserve the next slot
    dateAvailability.times = removeTimeSlots(dateAvailability.times, nextSlot);

    const reservation = await ReservationModel.findOneAndUpdate(
        { itemId, bookingDate },
        { $push: { timeSlots: nextSlot[0] } },
        { new: true, upsert: true }
        );
     await reservation.save();

    // Update item availability with the modified dateAvailability
    item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
    );

    await item.save();
    emitAvailabilityUpdate(itemId);

    return item;
});

export const releaseLastItemTimeSlot = handleRequest(async (req: Request) => {
    const { itemId, bookingDate, startTime, hours } = req.body;

    const item = await ItemModel.findOne({ _id: itemId });
    if (!item) throw new ExpressError('Item not found', 404);

    // Initialize availability if needed
    item.availability = initializeAvailability(item.availability);

    // Find or create the availability entry for the specified date
    const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, defaultHours);

    // Generate all booked time slots based on the current quantity
    const currentSlots = generateTimeSlots(startTime, Math.max(0, hours + 1));

    // Ensure currentSlots contains the correct slots based on hours booked
    const lastBookedSlot = currentSlots[currentSlots.length - 1]; // Get the last booked slot

    // Add the last slot back to available times
    dateAvailability.times = addTimeSlots(dateAvailability.times, [lastBookedSlot]);

    // Ensure times are deduplicated and sorted
    dateAvailability.times = Array.from(new Set(dateAvailability.times));

    const reservation = await ReservationModel.findOneAndUpdate(
        { itemId, bookingDate },
        { $pull: { timeSlots: lastBookedSlot } },
        { new: true }
        );

        
    await reservation?.save();
    // Update item availability with the modified dateAvailability
    item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
    );

    if (hours === 0 && reservation) {
        await ReservationModel.deleteOne({ _id: reservation._id });
    }
    await item.save();
    emitAvailabilityUpdate(itemId);

    return item;
});



const releaseItemTimeSlots = handleRequest(async (req: Request) => {
    const { itemId, bookingDate, startTime, hours } = req.body;

    const item = await ItemModel.findOne({ _id: itemId });
    if (!item) throw new ExpressError('Item not found', 404);

    // Initialize availability if necessary
    item.availability = initializeAvailability(item.availability);

    // Find or create the availability entry for the specified date
    const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, defaultHours);

    // Generate all time slots for the day starting from `startTime` for the item duration
    const allBookedSlots = generateTimeSlots(startTime, hours);

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

    const reservation = await ReservationModel.findOne(
        { itemId, bookingDate }
    );

    if (reservation) {
        await ReservationModel.deleteOne({ _id: reservation._id });
    }


    await item.save();
    emitAvailabilityUpdate(itemId);

    return item;
});

export default {
    reserveItemTimeSlots,
    reserveNextItemTimeSlot,
    releaseLastItemTimeSlot,
    releaseItemTimeSlots,
};
