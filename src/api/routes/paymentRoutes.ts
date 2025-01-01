
// import express from 'express';
// import { handlePaymentSuccess } from   '../handlers/paymentHandler.js';
// const router = express.Router();

// // Endpoint to confirm the payment after it's processed
// router.post('/payment-success', async (req, res) => {
//   const { orderId, cart, merchantId, user } = req.body;

//   try {
//     const result = await handlePaymentSuccess(orderId, cart, merchantId, user);
//     res.status(200).json(result);
//   } catch (error) {
//     console.error('Error confirming payment:', error);
//     res.status(500).json({ message: 'Payment processing failed', error: error.message });
//   }
// });

// module.exports = router;
