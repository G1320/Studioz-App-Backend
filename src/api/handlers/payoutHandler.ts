import { PAYPAL_BASE_URL } from "../../config/index.js";
import { PayoutModel } from "../../models/payoutModel.js";
import { generateAccessToken } from "./PPAuthHandler.js";
import axios from 'axios';

// payoutService.ts
export const processSellerPayout = async (
    sellerId: string, 
    amount: number,
    orderId: string
  ) => {
    try {
      const payout = await processPayout(sellerId, amount);
      
      await new PayoutModel({
        sellerId,
        amount,
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
                value: amount.toString(),
                currency: 'ILS'
              },
              receiver: sellerId,
              note: 'Payout for studio bookings',
              sender_item_id: `PAYOUT_ITEM_${Date.now()}`
            }
          ]
        }
      });
  
      console.log('response: ', response);
      return response.data;
    } catch (error) {
      console.error('Payout failed:', error);
      throw error;
    }
  };
  