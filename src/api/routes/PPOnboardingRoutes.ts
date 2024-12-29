import express from "express";
import { generateSellerSignupLink } from '../handlers/PPOnboardingHandler.js';
import { UserModel } from "../../models/userModel.js";


const router = express.Router();

const CLIENT_URL = process.env.NODE_ENV === 'production' 
  ? 'https://studioz.co.il'
  : 'http://localhost:5173';  

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

  router.get('/onboarding/renew', async (req, res) => {
    try {
      const { merchantId } = req.query;
      const newSignupLink = await generateSellerSignupLink(merchantId);
      res.redirect(newSignupLink);
    } catch (error) {
      res.redirect('/onboarding-error');
    }
  });

  export default router;
