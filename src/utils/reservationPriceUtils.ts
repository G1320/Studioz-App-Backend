import { AddOnModel } from '../models/addOnModel.js';

/**
 * Calculates the total price for a reservation including item price and add-ons
 * @param itemPrice - The base price of the item
 * @param timeSlots - Array of time slots (hours)
 * @param addOnIds - Array of add-on IDs (optional)
 * @returns The total price including add-ons
 */
export const calculateReservationTotalPrice = async (
  itemPrice: number,
  timeSlots: string[],
  addOnIds?: string[]
): Promise<number> => {
  // Calculate base price: itemPrice * number of time slots (hours)
  let totalPrice = (itemPrice || 0) * (timeSlots?.length || 0);

  // Add add-on prices if there are any
  if (addOnIds && addOnIds.length > 0) {
    try {
      const addOns = await AddOnModel.find({ _id: { $in: addOnIds } });
      const hours = timeSlots?.length || 0;

      for (const addOn of addOns) {
        if (addOn.price) {
          // If pricePer is "hour", multiply by number of hours
          if (addOn.pricePer === 'hour') {
            totalPrice += addOn.price * hours;
          } else {
            // For "session", "song", "unit", add once
            totalPrice += addOn.price;
          }
        }
      }
    } catch (error) {
      // If there's an error fetching add-ons, log it but return base price
      console.error('Error fetching add-ons for totalPrice calculation:', error);
    }
  }

  return totalPrice;
};

