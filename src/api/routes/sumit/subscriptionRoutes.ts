import express from 'express';
import subscriptionHandler from '../../handlers/sumit/subscriptionHandler.js';

const router = express.Router();

router.post('/create', subscriptionHandler.createSubscription);

router.post('/activate', subscriptionHandler.activateSubscription);

router.post('/cancel/:subscriptionId', subscriptionHandler.cancelSubscription);

router.get('/:subscriptionId', subscriptionHandler.getSubscriptionDetails);

router.post('/webhook', subscriptionHandler.handleSumitWebhook);

// Trial subscription routes
router.get('/trial-status/:userId', subscriptionHandler.getTrialStatus);
router.post('/cancel-trial/:subscriptionId', subscriptionHandler.cancelTrialSubscription);

export default router;