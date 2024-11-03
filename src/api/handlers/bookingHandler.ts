import { Request } from 'express';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { ItemModel } from '../../models/itemModel.js';

const bookStudioItem = handleRequest(async (req: Request) => {
    const { itemId, bookingDate, startTime, hours } = req.body;

    const item = await ItemModel.findOne({ _id: itemId });
    if (!item) throw new ExpressError('Item not found', 404);

    // Initialize availability if undefined
    item.availability = item.availability || [];
    
    // Define default hours for availability
    const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    
    // Locate or create availability entry for the booking date
    let dateAvailability = item.availability.find(avail => avail.date === bookingDate) ||
        { date: bookingDate, times: [...defaultHours] };

    // If a new dateAvailability is created, push it to the array
    if (!item.availability.some(avail => avail.date === bookingDate)) {
        item.availability.push(dateAvailability);
    }

    // Generate array of consecutive time slots needed
    const startHour = parseInt(startTime.split(':')[0]);
    const timeSlots = Array.from(
        { length: hours }, 
        (_, i) => `${String(startHour + i).padStart(2, '0')}:00`
    );

    // Verify all needed time slots are available
    const areAllSlotsAvailable = timeSlots.every(slot => 
        dateAvailability.times.includes(slot)
    );

    if (!areAllSlotsAvailable) {
        throw new ExpressError('One or more requested time slots are not available', 400);
    }

    // Remove all selected time slots
    dateAvailability.times = dateAvailability.times.filter(
        time => !timeSlots.includes(time)
    );

    // Update item.availability with the modified dateAvailability
    item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
    );

    await item.save();

    return item;
});

export default {
    bookStudioItem,
};
