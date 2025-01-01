import express from "express";
import { processPayout, processSellerPayout } from "../handlers/payoutHandler.js";

const router = express.Router();

router.post('/payouts',  async (req, res) => {
    try {
      const { sellerId, amount } = req.body;
      const payout = await processPayout(sellerId, amount);
      res.json(payout);
    } catch (error) {
      console.error('Payout processing failed:', error);
      res.status(500).json({ error: 'Failed to process payout' });
    }
  });
router.post('/seller-payouts',  async (req, res) => {
    try {
      const { sellerId, amount, orderId } = req.body;
      const payout = await processSellerPayout(sellerId, amount, orderId);
      res.json(payout);
    } catch (error) {
      console.error('Seller payout processing failed:', error);
      res.status(500).json({ error: 'Failed to process seller  payout' });
    }
  });


  