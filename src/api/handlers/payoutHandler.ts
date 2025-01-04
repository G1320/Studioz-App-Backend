import { PAYPAL_BASE_URL } from "../../config/index.js";
import { PayoutModel } from "../../models/payoutModel.js";
import { generateAccessToken } from "./PPAuthHandler.js";
import axios from 'axios';
import { calculateMarketplaceFee } from "./PPorderHandler.js";

const convertILStoUSD = (ilsAmount:number) => {
    // Using a fixed conversion rate for sandbox testing
    // In production, you'd want to use a real-time exchange rate
    const rate = 0.27; // Approximate ILS to USD rate
    return parseFloat((ilsAmount * rate).toFixed(2));
  };

export const processSellerPayout = async (
    sellerId: string, 
    amount: number,
    orderId: string
  ) => {
    try {

         const fees = calculateMarketplaceFee(amount);
      const payout = await processPayout(sellerId, fees.sellerAmount);
      
      await new PayoutModel({
        sellerId,
        amount: fees.sellerAmount,
        orderId,
        payoutId: payout.batch_header.payout_batch_id,
        status: payout.batch_header.batch_status,
        timestamp: new Date()
      }).save();
  
      return payout;
    } catch (error) {
      console.error('Payout failed:', error);
      throw error;
    }
  };


export const processPayout = async (sellerId:string, amount:number) => {
    const accessToken = await generateAccessToken();

    const isProduction = process.env.NODE_ENV === 'production';
    const payoutAmount = isProduction ? amount : convertILStoUSD(amount);
    
    const currency = isProduction ? 'ILS' : 'USD';

  
    try {
      const response = await axios({
        url: `${PAYPAL_BASE_URL}/v1/payments/payouts`,
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        data: {
          sender_batch_header: {
            sender_batch_id: `PAYOUT_${Date.now()}`,
            email_subject: 'You have a payout!',
            email_message: 'You have received a payout from your studio bookings'
          },
          items: [
            {
              recipient_type: 'PAYPAL_ID',
              amount: {
                value: payoutAmount.toString(),
                currency: currency
              },
              receiver: sellerId,
              note: 'Payout for studio bookings',
              sender_item_id: `PAYOUT_ITEM_${Date.now()}`
            }
          ]
        }
      });
  
      return response.data;
    } catch (error) {
      console.error('Payout failed:', error);
      throw error;
    }
  };
  