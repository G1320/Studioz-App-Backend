import express from "express";
import { processSellerPayout,  } from "../../handlers/paypalHandlers/payoutHandler.js";
import { calculateMarketplaceFee } from "../../handlers/paypalHandlers/orderHandler.js";

const router = express.Router();

router.post('/seller-payouts',  async (req, res) => {
    try {
      const { sellerId, amount, orderId } = req.body;

     const fees = calculateMarketplaceFee(amount);


      const payout = await processSellerPayout(sellerId, fees.sellerAmount, orderId);
      res.json(payout);
    //   res.json({ message: 'Payout processed successfully' });
    } catch (error) {
      console.error('Seller payout processing failed:', error);
      res.status(500).json({ error: 'Failed to process seller  payout' });
    }
  });


export default router;