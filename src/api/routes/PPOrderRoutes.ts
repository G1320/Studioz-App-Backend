// routes/ordersRoutes.js
import express from "express";
import {  capturePayment, getOrderDetails } from "../handlers/PPorderHandler.js";
import {  createMarketplaceOrder } from '../handlers/PPorderHandler.js';

const router = express.Router();

router.post("/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    console.log('orderID: ', orderID);
    const  jsonResponse  = await capturePayment(orderID);
    res.status(200).json(jsonResponse);
  } catch (error:any) {
    console.error("Failed to capture order:", error);
    res.status(500).json({ error: "Failed to capture order", details: error.message });
}
});

router.post('/orders/:orderId',  async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await getOrderDetails(orderId);
    res.json(order);
  } catch (error) {
    console.error('Order capture failed:', error);
    res.status(500).json({ error: 'Failed to capture order' });
  }
})

router.post('/marketplace/orders',  async (req, res) => {
  try {
    const { cart, merchantId } = req.body;
    const order = await createMarketplaceOrder(cart, merchantId);
    res.json(order);
  } catch (error) {
    console.error('Marketplace order creation failed:', error);
    res.status(500).json({ error: 'Failed to create marketplace order' });
  }
});




router.post('/webhooks', async (req, res) => {
  try {
    const event = req.body;
    
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        break;
      case 'MERCHANT.ONBOARDING.COMPLETED':
        break;
      case 'MERCHANT.PARTNER-CONSENT.REVOKED':
        break;
      default:
        console.log('Unhandled webhook event:', event.event_type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});




export default router;
