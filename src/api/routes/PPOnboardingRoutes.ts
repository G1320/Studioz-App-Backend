import express from "express";
import { checkSellerAccountStatus, generateSellerSignupLink } from '../handlers/PPOnboardingHandler.js';
import { UserModel } from "../../models/userModel.js";


interface PayPalOAuthIntegration {
    status: string;
    integration_type: string;
  }

const router = express.Router();

const CLIENT_URL = process.env.NODE_ENV === 'production' 
  ? 'https://studioz.co.il'
  : 'http://localhost:5173';  

router.post('/seller/generate-signup-link',  async (req, res) => {
    try {
      const { sellerId } = req.body;
      const signupLink = await generateSellerSignupLink(sellerId);
      res.json({ signupLink });
    } catch (error:any) {
      console.error('Seller signup link generation failed:', error);
      console.error('Marketplace order creation failed:', error);
    console.log('PayPal Error Details:', error.response?.data?.details);
    console.log('Full PayPal Error:', {
      name: error.response?.data?.name,
      message: error.response?.data?.message,
      details: error.response?.data?.details,
      debugId: error.response?.data?.debug_id
    });
      res.status(500).json({ error: 'Failed to generate seller signup link' });
    }
  });

  router.get('/seller/check-status/:merchantId', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const status = await checkSellerAccountStatus(merchantId);
      res.json(status);
    } catch (error) {
      console.error('Status check failed:', error);
      res.status(500).json({ error: 'Failed to check seller status' });
    }
  });

//   router.get('/seller/onboard-complete/:sellerId', async (req, res) => {
//     try {
//       const { 
//         merchantId, 
//         merchantIdInPayPal, 
//         permissionsGranted, 
//         consentStatus 
//       } = req.query;
  
//       if (permissionsGranted === 'true' && consentStatus === 'true') {
//         // Check account status before completing onboarding
//         try {
//           const merchantStatus = await checkSellerAccountStatus(merchantIdInPayPal);
          
//           // Check various status properties
//           const isReady = merchantStatus.payments_receivable && 
//           merchantStatus.primary_email_confirmed &&
//           !merchantStatus.oauth_integrations.some((integration: PayPalOAuthIntegration) => 
//             integration.status === 'INACTIVE'
//           );
  
//           if (isReady) {
//             await UserModel.findByIdAndUpdate(merchantId, {
//               paypalMerchantId: merchantIdInPayPal,
//               paypalOnboardingStatus: 'COMPLETED',
//               paypalAccountStatus: merchantStatus
//             });
  
//             res.redirect(`${CLIENT_URL}/profile?onboarding=success`);
//           } else {
//             // Handle incomplete setup
//             await UserModel.findByIdAndUpdate(merchantId, {
//               paypalMerchantId: merchantIdInPayPal,
//               paypalOnboardingStatus: 'PENDING',
//               paypalAccountStatus: merchantStatus
//             });
  
//             res.redirect(`${CLIENT_URL}/profile?onboarding=incomplete`);
//           }
//         } catch (statusError) {
//           console.error('Error checking merchant status:', statusError);
//           res.redirect(`${CLIENT_URL}/profile?onboarding=status-check-failed`);
//         }
//       } else {
//         res.redirect(`${CLIENT_URL}/profile?onboarding=failed`);
//       }
//     } catch (error) {
//       console.error('Onboarding completion error:', error);
//       res.redirect('/profile?onboarding=error');
//     }
//   });

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
