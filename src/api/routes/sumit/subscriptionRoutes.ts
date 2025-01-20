import express from 'express';
import subscriptionHandler from '../../handlers/sumit/subscriptionHandler.js';

const router = express.Router();

router.post('/create', subscriptionHandler.createSubscription);

router.post('/activate', subscriptionHandler.activateSubscription);

router.post('/cancel/:subscriptionId', subscriptionHandler.cancelSubscription);

router.post('/webhook', subscriptionHandler.handleSumitWebhook);

export default router;