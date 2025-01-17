import express from 'express';
import subscriptionHandler from '../../handlers/paypalHandlers/subscriptionHandler.js';

const router = express.Router();

// Create a new subscription
router.post('/create',  subscriptionHandler.createSubscription);

// Activate a subscription after PayPal approval
router.post('/activate',  subscriptionHandler.activateSubscription);

// Cancel an existing subscription
router.post('/cancel/:subscriptionId',  subscriptionHandler.cancelSubscription);

// Get subscription details
router.get('/:subscriptionId', subscriptionHandler.getSubscriptionDetails);

// PayPal webhook endpoint (no auth required as it's called by PayPal)
router.post('/webhook', subscriptionHandler.handlePayPalWebhook);

export default router;