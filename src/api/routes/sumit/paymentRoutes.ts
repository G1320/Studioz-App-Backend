import express from 'express';
import { paymentHandler } from '../../handlers/sumit/paymentHandler.js';
import { verifyTokenMw, requireFeature, checkPaymentLimit } from '../../../middleware/index.js';

const router = express.Router();

router.post('/process-payment', paymentHandler.processPayment);

router.post('/create-subscription', paymentHandler.createSubscription);

router.post('/cancel-subscription/:subscriptionId', paymentHandler.cancelSubscription);

// Multivendor charge - requires payments feature and checks limit
router.post('/multivendor-charge', 
  verifyTokenMw, 
  requireFeature('payments'), 
  checkPaymentLimit, 
  paymentHandler.multivendorCharge
);

// Quick charge for studio owners (סליקה מהירה) - requires payments feature and checks limit
router.post('/quick-charge', 
  verifyTokenMw, 
  requireFeature('payments'), 
  checkPaymentLimit, 
  paymentHandler.quickCharge
);

router.post('/validate-token', paymentHandler.validateToken);

router.post('/webhook', paymentHandler.handleWebhook);

// Reservation payment routes (save card for later, charge on approval)
// Note: save-card doesn't require feature check (anyone can save card)
// charge-saved-card requires payments feature
router.post('/save-card', paymentHandler.saveCardForLaterCharge);
router.post('/charge-saved-card', 
  verifyTokenMw, 
  requireFeature('payments'), 
  checkPaymentLimit, 
  paymentHandler.chargeSavedCard
);
router.post('/refund', verifyTokenMw, paymentHandler.refundPayment);

// Get saved card by phone (for non-logged-in users)
router.post('/saved-card-by-phone', paymentHandler.getSavedCardByPhone);

// Trial subscription routes (no feature check - these are for subscribing)
router.post('/create-subscription-trial', paymentHandler.createSubscriptionWithTrial);
router.post('/charge-trial-subscription', paymentHandler.chargeTrialSubscription);
router.get('/trial-subscriptions-ending', paymentHandler.getTrialSubscriptionsEnding);

// Create invoice/document (חשבונית חדשה) - requires payments feature
router.post('/create-invoice', 
  verifyTokenMw, 
  requireFeature('payments'), 
  paymentHandler.createDocument
);

export default router;