import express from 'express';
import { paymentHandler } from '../../handlers/sumit/paymentHandler.js';

const router = express.Router();

router.post('/process-payment',paymentHandler.processPayment);

router.post('/create-subscription',paymentHandler.createSubscription);

router.post('/cancel-subscription/:subscriptionId',paymentHandler.cancelSubscription);

router.post('/multivendor-charge', paymentHandler.multivendorCharge);

router.post('/validate-token',paymentHandler.validateToken);

router.post('/webhook', paymentHandler.handleWebhook);
export default router ;