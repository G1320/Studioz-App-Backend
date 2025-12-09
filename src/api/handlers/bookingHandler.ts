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
import { emitAvailabilityUpdate, emitReservationUpdate } from '../../webSockets/socket.js';
import { ReservationModel } from '../../models/reservationModel.js';
import { UserModel } from '../../models/userModel.js';
import { RESERVATION_STATUS } from '../../services/reservationService.js';
import Reservation from '../../types/reservation.js';
import { notifyVendorNewReservation, notifyCustomerReservationConfirmed, notifyVendorReservationCancelled } from '../../utils/notificationUtils.js';


const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

export const releaseReservationTimeSlots = async (reservation: Reservation) => {
    const item = await ItemModel.findById(reservation.itemId);
    if (!item) {
        console.log('Item not found for reservation:', reservation._id);
        return;
    }
  
    // Initialize availability if needed
    item.availability = initializeAvailability(item.availability);
    
    // Find or create availability entry for the booking date
    const dateAvailability = findOrCreateDateAvailability(
      item.availability, 
      reservation.bookingDate, 
      defaultHours
    );

    // Add the expired reservation's time slots back to availability
    dateAvailability.times = addTimeSlots(dateAvailability.times, reservation.timeSlots);
  

    // Update item's availability
    item.availability = item.availability.map(avail =>
      avail.date === reservation.bookingDate ? dateAvailability : avail
    );
  
    await item.save();
    emitAvailabilityUpdate(item._id);
};


const reserveStudioTimeSlots = handleRequest(async (req: Request) => {
    const { studioId, bookingDate, startTime, hours } = req.body;

    // Find all items belonging to the studio
    const studioItems = await ItemModel.find({ studioId });
    if (!studioItems.length) throw new ExpressError('No items found for this studio', 404);

    const updatedItems = [];

    for (const item of studioItems) {
        // Initialize availability
        item.availability = initializeAvailability(item.availability);
            
        // Find or create availability entry for the booking date
        const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, defaultHours);

        // Generate array of consecutive time slots needed
        const timeSlots = generateTimeSlots(startTime, hours);       
        
        // Remove all selected time slots
        dateAvailability.times = removeTimeSlots(dateAvailability.times, timeSlots);
        
        // Update item.availability with the modified dateAvailability
        item.availability = item.availability.map(avail =>
            avail.date === bookingDate ? dateAvailability : avail
        );
            
        await item.save();
        
        updatedItems.push(item);
        emitAvailabilityUpdate(item._id);
    }

    return {
        message: `Successfully blocked time slots for ${updatedItems.length} items`,
        items: updatedItems
    };
});

const reserveItemTimeSlots = handleRequest(async (req: Request) => {
    const { itemId, bookingDate, startTime, hours, customerId, customerName, customerPhone, comment } = req.body;

    const item = await ItemModel.findOne({ _id: itemId });
    if (!item) throw new ExpressError('Item not found', 404);

    const user = await UserModel.findById(customerId);
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
    
    // Set status based on instantBook: CONFIRMED if true, PENDING if false
    const reservationStatus = item.instantBook 
        ? RESERVATION_STATUS.CONFIRMED 
        : RESERVATION_STATUS.PENDING;
    
    const reservation = new ReservationModel({
        itemId,
        itemName:{
            en: item.name?.en,
            he: item.name?.he
        },
        studioName: item.studioName,
        bookingDate,
        timeSlots,
        expiration,
        itemPrice: item.price||0,
        studioId: item.studioId,
        customerId,
        customerName,
        customerPhone,
        comment,
        status: reservationStatus

    });
    
    // Remove all selected time slots
    dateAvailability.times = removeTimeSlots(dateAvailability.times, timeSlots);
    
    // Update item.availability with the modified dateAvailability
    item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
        );

    user?.reservations?.push(reservation._id);
        
    await reservation.save();
    await item.save();
    await user?.save();
    emitAvailabilityUpdate(itemId);
    emitReservationUpdate(
      [reservation._id.toString()],
      reservation.customerId?.toString() || reservation.userId?.toString() || ''
    );

    // Notify vendor (studio owner) about new reservation
    if (reservation.studioId && reservation._id) {
      await notifyVendorNewReservation(
        reservation._id.toString(),
        reservation.studioId.toString(),
        itemId.toString(),
        customerName || user?.name
      );
    }

    // Notify customer if reservation is confirmed
    if (reservation.status === RESERVATION_STATUS.CONFIRMED && customerId) {
      await notifyCustomerReservationConfirmed(
        reservation._id.toString(),
        customerId.toString()
      );
    }

    return reservation._id;
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
        reservation.status = RESERVATION_STATUS.CANCELLED;
        await reservation.save();

        emitReservationUpdate(
          [reservation._id.toString()],
          reservation.customerId?.toString() || reservation.userId?.toString() || ''
        );
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
        // Notify vendor about cancellation before updating status
        if (reservation.studioId && reservation.customerName) {
          await notifyVendorReservationCancelled(
            reservation._id.toString(),
            reservation.studioId.toString(),
            itemId.toString(),
            reservation.customerName
          );
        }

        reservation.status = RESERVATION_STATUS.CANCELLED;
        await reservation.save();

        emitReservationUpdate(
          [reservation._id.toString()],
          reservation.customerId?.toString() || reservation.userId?.toString() || ''
        );
    }


    await item.save();
    emitAvailabilityUpdate(itemId);

    return item;
});

const confirmBooking = handleRequest(async (req: Request) => {
    const { reservationIds, orderId } = req.body;
  
    if (!reservationIds?.length) {
        throw new ExpressError('No reservation IDs provided', 400);
    }
  
    // Get the specific reservations
    const pendingReservations = await ReservationModel.find({
      _id: { $in: reservationIds },
      status: RESERVATION_STATUS.PENDING
    });

    if (!pendingReservations.length) {
        throw new ExpressError('No pending reservations found', 404);
    }
  
    // Update the specific reservations to confirmed
    const updatePromises = pendingReservations.map(reservation => {
        reservation.status = RESERVATION_STATUS.CONFIRMED;
        reservation.orderId = orderId;
        return reservation.save();
    });
  
    const confirmedReservations = await Promise.all(updatePromises);
  
    // Emit socket events for each updated item
    confirmedReservations.forEach(reservation => {
        emitAvailabilityUpdate(reservation.itemId);
        emitReservationUpdate(
          [reservation._id.toString()],
          reservation.customerId?.toString() || reservation.userId?.toString() || ''
        );
    });

    // Notify customers that their reservations are confirmed
    for (const reservation of confirmedReservations) {
      if (reservation.customerId) {
        await notifyCustomerReservationConfirmed(
          reservation._id.toString(),
          reservation.customerId.toString()
        );
      }
    }
  
    return {
        message: 'Reservations confirmed successfully',
        confirmedReservations
    };
});

export default {
    reserveItemTimeSlots,
    reserveNextItemTimeSlot,
    releaseLastItemTimeSlot,
    releaseItemTimeSlots,
    reserveStudioTimeSlots,
    confirmBooking
};
