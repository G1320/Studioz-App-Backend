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
    addTimeSlots,
    DEFAULT_HOURS
} from '../../utils/timeSlotUtils.js';

// Alias for backwards compatibility - TODO: Refactor to use getStudioOperatingHours
const defaultHours = DEFAULT_HOURS;
import { emitAvailabilityUpdate, emitReservationUpdate } from '../../webSockets/socket.js';
import { ReservationModel } from '../../models/reservationModel.js';
import { UserModel } from '../../models/userModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { RESERVATION_STATUS } from '../../services/reservationService.js';
import Reservation from '../../types/reservation.js';
import { notifyVendorNewReservation, notifyCustomerReservationConfirmed, notifyVendorReservationCancelled } from '../../utils/notificationUtils.js';
import {
    releaseItemTimeSlots as releaseItemSlots,
    releaseStudioWideTimeSlots,
    getStudioOperatingHours
} from '../../services/availabilityService.js';
import { paymentService } from '../../services/paymentService.js';


export const releaseReservationTimeSlots = async (reservation: Reservation) => {
    // Release time slots for the main item
    await releaseItemSlots(
        reservation.itemId.toString(),
        reservation.bookingDate,
        reservation.timeSlots
    );

    // Release time slots for all other items in the studio
    if (reservation.studioId && reservation.timeSlots) {
        await releaseStudioWideTimeSlots(
            reservation.studioId.toString(),
            reservation.bookingDate,
            reservation.timeSlots,
            reservation.itemId.toString() // exclude the main item
        );
    }
};


const reserveStudioTimeSlots = handleRequest(async (req: Request) => {
    const { studioId, bookingDate, startTime, hours } = req.body;

    // Find all items belonging to the studio
    const studioItems = await ItemModel.find({ studioId });
    if (!studioItems.length) throw new ExpressError('No items found for this studio', 404);

    const updatedItems = [];

    // Process all items and prepare updates
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

        updatedItems.push(item);
    }

    // Save all items in parallel (fixes N+1 query pattern)
    await Promise.all(updatedItems.map(item => item.save()));

    // Emit updates after all saves complete
    updatedItems.forEach(item => emitAvailabilityUpdate(item._id));

    return {
        message: `Successfully blocked time slots for ${updatedItems.length} items`,
        items: updatedItems
    };
});

const reserveItemTimeSlots = handleRequest(async (req: Request) => {
    const { 
        itemId, bookingDate, startTime, hours, customerId, customerName, customerPhone, comment, addOnIds,
        // Optional payment fields - only used when vendor accepts payments
        singleUseToken, customerEmail, useSavedCard 
    } = req.body;

    const item = await ItemModel.findOne({ _id: itemId });
    if (!item) throw new ExpressError('Item not found', 404);

    // Check if item is active (not disabled)
    if (item.active === false) {
        throw new ExpressError('This service is currently unavailable', 400);
    }

    // Get studio address and cover image for the reservation
    const studio = await StudioModel.findById(item.studioId);
    const studioAddress = studio?.address || '';
    const studioImgUrl = studio?.coverImage || '';

    // Check if studio is active (not disabled)
    if (studio && studio.active === false) {
        throw new ExpressError('This studio is currently unavailable', 400);
    }

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
    const expiration = new Date(Date.now() + 60 * 60 * 1000); // 60-minute hold
    
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
        status: reservationStatus,
        addOnIds: addOnIds || [],
        address: studioAddress,
        studioImgUrl
        // totalPrice will be calculated by the pre-save hook
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

    // Update time slots for all other items in the studio (studio will be busy during this session)
    if (item.studioId) {
        const studioItems = await ItemModel.find({ studioId: item.studioId, _id: { $ne: itemId } });
        // Prepare all updates first
        for (const studioItem of studioItems) {
            studioItem.availability = initializeAvailability(studioItem.availability);
            const studioItemDateAvailability = findOrCreateDateAvailability(studioItem.availability, bookingDate, defaultHours);
            studioItemDateAvailability.times = removeTimeSlots(studioItemDateAvailability.times, timeSlots);
            studioItem.availability = studioItem.availability.map(avail =>
                avail.date === bookingDate ? studioItemDateAvailability : avail
            );
        }
        // Save all in parallel (fixes N+1 query pattern)
        await Promise.all(studioItems.map(si => si.save()));
        studioItems.forEach(si => emitAvailabilityUpdate(si._id));
    }
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

    // Increment totalBookings on studio when reservation is confirmed
    if (reservation.status === RESERVATION_STATUS.CONFIRMED && reservation.studioId) {
      await StudioModel.findByIdAndUpdate(
        reservation.studioId,
        { $inc: { totalBookings: 1 } }
      );
    }

    // Sync to Google Calendar if connected
    try {
      const { syncReservationToCalendar } = await import('../../services/googleCalendarService.js');
      await syncReservationToCalendar(reservation);
    } catch (error) {
      console.error('Error syncing reservation to Google Calendar:', error);
      // Don't fail the reservation creation if calendar sync fails
    }

    // ============================================================
    // OPTIONAL PAYMENT HANDLING
    // Processes payment if customer provides payment info and vendor accepts payments
    // ============================================================
    const hasPaymentInfo = singleUseToken || useSavedCard;
    const canProcessPayment = reservation.totalPrice && reservation.totalPrice > 0 && studio?.createdBy;
   
    if (hasPaymentInfo && canProcessPayment) {
      try {
        let paymentResult = null;
        
        // Option 1: New card payment via single-use token
        if (singleUseToken) {
          paymentResult = await paymentService.handleReservationPayment({
            singleUseToken,
            customerInfo: {
              name: customerName || user?.name || 'Customer',
              email: customerEmail || user?.email || '',
              phone: customerPhone || ''
            },
            vendorId: studio.createdBy.toString(),
            userId: customerId, // Save card on user for future payments
            amount: reservation.totalPrice || 0,
            itemName: item.name?.en || 'Reservation',
            instantCharge: !!item.instantBook
          });
        }
        // Option 2: Saved card payment
        else if (useSavedCard && customerId && user?.sumitCustomerId) {
          const paymentAmount = reservation.totalPrice || 0;
          
          // If instant book, charge immediately
          if (item.instantBook) {
            const chargeResult = await paymentService.chargeWithSavedCard({
              userId: customerId,
              vendorId: studio.createdBy.toString(),
              amount: paymentAmount,
              description: `Booking: ${item.name?.en || 'Reservation'}`
            });
            
            if (chargeResult.success) {
              paymentResult = {
                paymentStatus: 'charged' as const,
                paymentDetails: {
                  sumitCustomerId: user.sumitCustomerId,
                  amount: paymentAmount,
                  currency: 'ILS',
                  vendorId: studio.createdBy.toString(),
                  sumitPaymentId: chargeResult.paymentId,
                  chargedAt: new Date()
                }
              };
            } else {
              paymentResult = {
                paymentStatus: 'failed' as const,
                paymentDetails: {
                  sumitCustomerId: user.sumitCustomerId,
                  amount: paymentAmount,
                  currency: 'ILS',
                  vendorId: studio.createdBy.toString(),
                  failureReason: chargeResult.error
                }
              };
            }
          } else {
            // Not instant book - just mark card as ready, charge on approval
            paymentResult = {
              paymentStatus: 'card_saved' as const,
              paymentDetails: {
                sumitCustomerId: user.sumitCustomerId,
                amount: paymentAmount,
                currency: 'ILS',
                vendorId: studio.createdBy.toString()
              }
            };
          }
        }

        // If payment was processed, update reservation
        if (paymentResult) {
          reservation.paymentStatus = paymentResult.paymentStatus;
          reservation.paymentDetails = paymentResult.paymentDetails;
          
          // If payment failed, release slots and throw error to client
          if (paymentResult.paymentStatus === 'failed') {
            reservation.status = RESERVATION_STATUS.PAYMENT_FAILED;
            await reservation.save();
            
            // Release the time slots since payment failed
            await releaseReservationTimeSlots(reservation);
            
            // Throw error so client knows payment failed
            const failureReason = paymentResult.paymentDetails?.failureReason || 'Payment processing failed';
            throw new ExpressError(`Payment failed: ${failureReason}`, 402);
          }
          
          await reservation.save();
        }
        // If paymentResult is null, vendor doesn't accept payments - reservation continues without payment
      } catch (paymentError: any) {
        // If it's our ExpressError, rethrow it
        if (paymentError instanceof ExpressError) {
          throw paymentError;
        }
        // Unexpected payment error - log and throw
        console.error('Payment processing error:', paymentError);
        throw new ExpressError('Payment processing failed. Please try again.', 500);
      }
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
    
    // Mark timeSlots as modified so pre-save hook knows to recalculate totalPrice
    // Since findOneAndUpdate doesn't track modifications, we need to explicitly mark it
    if (reservation) {
        reservation.markModified('timeSlots');
        await reservation.save(); // Pre-save hook will recalculate totalPrice
    }

    // Update item availability with the modified dateAvailability
    item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
    );

    await item.save();
    emitAvailabilityUpdate(itemId);

    // Update time slots for all other items in the studio (studio will be busy during this session)
    if (item.studioId) {
        const studioItems = await ItemModel.find({ studioId: item.studioId, _id: { $ne: itemId } });
        // Prepare all updates first
        for (const studioItem of studioItems) {
            studioItem.availability = initializeAvailability(studioItem.availability);
            const studioItemDateAvailability = findOrCreateDateAvailability(studioItem.availability, bookingDate, defaultHours);
            studioItemDateAvailability.times = removeTimeSlots(studioItemDateAvailability.times, nextSlot);
            studioItem.availability = studioItem.availability.map(avail =>
                avail.date === bookingDate ? studioItemDateAvailability : avail
            );
        }
        // Save all in parallel (fixes N+1 query pattern)
        await Promise.all(studioItems.map(si => si.save()));
        studioItems.forEach(si => emitAvailabilityUpdate(si._id));
    }

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

    // Mark timeSlots as modified so pre-save hook knows to recalculate totalPrice
    // Since findOneAndUpdate doesn't track modifications, we need to explicitly mark it
    if (reservation) {
        reservation.markModified('timeSlots');
        await reservation.save(); // Pre-save hook will recalculate totalPrice
    }
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

    // Release time slots for all other items in the studio (studio is no longer busy during this slot)
    if (item.studioId) {
        const studioItems = await ItemModel.find({ studioId: item.studioId, _id: { $ne: itemId } });
        // Prepare all updates first
        for (const studioItem of studioItems) {
            studioItem.availability = initializeAvailability(studioItem.availability);
            const studioItemDateAvailability = findOrCreateDateAvailability(studioItem.availability, bookingDate, defaultHours);
            studioItemDateAvailability.times = addTimeSlots(studioItemDateAvailability.times, [lastBookedSlot]);
            studioItemDateAvailability.times = Array.from(new Set(studioItemDateAvailability.times));
            studioItem.availability = studioItem.availability.map(avail =>
                avail.date === bookingDate ? studioItemDateAvailability : avail
            );
        }
        // Save all in parallel (fixes N+1 query pattern)
        await Promise.all(studioItems.map(si => si.save()));
        studioItems.forEach(si => emitAvailabilityUpdate(si._id));
    }

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

    // Release time slots for all other items in the studio (studio is no longer busy during these slots)
    if (item.studioId && slotsToRelease.length > 0) {
        const studioItems = await ItemModel.find({ studioId: item.studioId, _id: { $ne: itemId } });
        // Prepare all updates first
        for (const studioItem of studioItems) {
            studioItem.availability = initializeAvailability(studioItem.availability);
            const studioItemDateAvailability = findOrCreateDateAvailability(studioItem.availability, bookingDate, defaultHours);
            studioItemDateAvailability.times = addTimeSlots(studioItemDateAvailability.times, slotsToRelease);
            studioItemDateAvailability.times = Array.from(new Set(studioItemDateAvailability.times));
            studioItemDateAvailability.times.sort((a: string, b: string) => parseInt(a.split(':')[0]) - parseInt(b.split(':')[0]));
            studioItem.availability = studioItem.availability.map(avail =>
                avail.date === bookingDate ? studioItemDateAvailability : avail
            );
        }
        // Save all in parallel (fixes N+1 query pattern)
        await Promise.all(studioItems.map(si => si.save()));
        studioItems.forEach(si => emitAvailabilityUpdate(si._id));
    }

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

    // Notify customers that their reservations are confirmed (in parallel)
    const notificationPromises = confirmedReservations
      .filter(reservation => reservation.customerId)
      .map(reservation =>
        notifyCustomerReservationConfirmed(
          reservation._id.toString(),
          reservation.customerId!.toString()
        )
      );
    await Promise.all(notificationPromises);

    // Increment totalBookings for each unique studio (in parallel)
    // Group by studioId to avoid multiple increments for the same studio
    const studioIds = [...new Set(confirmedReservations.map(r => r.studioId?.toString()).filter(Boolean))];
    const studioUpdatePromises = studioIds.map(studioId => {
      const count = confirmedReservations.filter(r => r.studioId?.toString() === studioId).length;
      if (count > 0) {
        return StudioModel.findByIdAndUpdate(
          studioId,
          { $inc: { totalBookings: count } }
        );
      }
      return Promise.resolve();
    });
    await Promise.all(studioUpdatePromises);
  
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
