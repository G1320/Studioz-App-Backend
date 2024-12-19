// routes/ordersRoutes.js
import express from "express";
import { createOrder, capturePayment } from "../handlers/PPorderHandlerAPI.js";
import { generateSellerSignupLink, createMarketplaceOrder, processPayout } from '../handlers/PPorderHandlerAPI.js';
import { UserModel } from "../../models/userModel.js";
// import { requireAuth, validateAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

const CLIENT_URL = process.env.NODE_ENV === 'production' 
  ? 'https://studioz.co.il'
  : 'http://localhost:5174';  


router.post("/", async (req, res) => {
  try {
    const { cart } = req.body;
    const jsonResponse = await createOrder(cart);
    res.status(200).json(jsonResponse);
  } catch (error:any) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order", details: error.message });
}
});

router.post("/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const  jsonResponse  = await capturePayment(orderID);
    res.status(200).json(jsonResponse);
  } catch (error:any) {
    console.error("Failed to capture order:", error);
    res.status(500).json({ error: "Failed to capture order", details: error.message });
}
});

router.post('/seller/generate-signup-link',  async (req, res) => {
  try {
    const { sellerId } = req.body;
    const signupLink = await generateSellerSignupLink(sellerId);
    res.json({ signupLink });
  } catch (error) {
    console.error('Seller signup link generation failed:', error);
    res.status(500).json({ error: 'Failed to generate seller signup link' });
  }
});

// Onboarding completion callback route
router.get('/seller/onboard-complete/:sellerId', async (req, res) => {
    try {
      const { 
        merchantId, 
        merchantIdInPayPal, 
        permissionsGranted, 
        consentStatus 
      } = req.query;
      if (permissionsGranted === 'true' && consentStatus === 'true') {
        // Update your user/seller in the database with the PayPal merchant ID
        await UserModel.findByIdAndUpdate(merchantId, {
          paypalMerchantId: merchantIdInPayPal,
          paypalOnboardingStatus: 'COMPLETED'
        });
  
        // Redirect to a success page
        res.redirect(`${CLIENT_URL}/profile?onboarding=success`);
    } else {
      res.redirect(`${CLIENT_URL}/profile?onboarding=failed`);
      }
    } catch (error) {
      console.error('Onboarding completion error:', error);
      res.redirect('/profile?onboarding=error');
    }
  });

router.post('/marketplace/orders',  async (req, res) => {
  try {
    const { cart, sellerId } = req.body;
    const order = await createMarketplaceOrder(cart, sellerId);
    res.json(order);
  } catch (error) {
    console.error('Marketplace order creation failed:', error);
    res.status(500).json({ error: 'Failed to create marketplace order' });
  }
});

// New route in your backend
router.get('/onboarding/return', async (req, res) => {
    const { merchantId, merchantIdInPayPal } = req.query;
    
    try {
      // Store the PayPal merchant ID in your database
    //   await updateUserPayPalInfo(merchantId, {
    //     paypalMerchantId: merchantIdInPayPal,
    //     onboardingStatus: 'COMPLETED'
    //   });
  
      // Redirect to your frontend success page
      res.redirect('/onboarding/success');
    } catch (error) {
      console.error('Error handling onboarding return:', error);
      res.redirect('/onboarding/error');
    }
  });

// Payout Routes (Admin only)
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

router.get('/onboarding/renew', async (req, res) => {
    try {
      const { merchantId } = req.query;
      const newSignupLink = await generateSellerSignupLink(merchantId);
      res.redirect(newSignupLink);
    } catch (error) {
      res.redirect('/onboarding-error');
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
