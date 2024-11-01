import { Request } from 'express';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { ItemModel } from '../../models/itemModel.js';
import Availability from '../../types/availability.js';

const bookStudioItem = handleRequest(async (req: Request) => {
    const { itemId, bookingDate, startTime } = req.body;
    const userId = req.params.userId;

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

    // Check if the time slot is available
    const timeIndex = dateAvailability.times.indexOf(startTime);
    if (timeIndex === -1) throw new ExpressError('Time slot not available', 400);

    // Remove the selected time slot
    dateAvailability.times.splice(timeIndex, 1);

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
