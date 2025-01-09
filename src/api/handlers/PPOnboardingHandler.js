import axios from 'axios';

import {
  NODE_ENV,
  BASE_URL,
  PAYPAL_SANDBOX_BASE_URL,
  PAYPAL_SANDBOX_PARTNER_ID,
  PAYPAL_LIVE_BASE_URL,
  PAYPAL_LIVE_PARTNER_ID
} from '../../config/index.js';
import { generateAccessToken } from './PPAuthHandler.js';
// const isProduction = NODE_ENV === 'production';
const isProduction = false;

const PAYPAL_BASE_URL = isProduction ? PAYPAL_LIVE_BASE_URL : PAYPAL_SANDBOX_BASE_URL;
const PAYPAL_PARTNER_ID = isProduction ? PAYPAL_LIVE_PARTNER_ID : PAYPAL_SANDBOX_PARTNER_ID;

export const generateSellerSignupLink = async (sellerId) => {
  const accessToken = await generateAccessToken();

  try {
    const response = await axios({
      url: `${PAYPAL_BASE_URL}/v2/customer/partner-referrals`,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Partner-Attribution-Id': PAYPAL_PARTNER_ID
      },
      data: {
        tracking_id: sellerId,
        partner_config_override: {
          return_url: `${BASE_URL}/PPOnboarding/seller/onboard-complete/${sellerId}`
        },
        operations: [
          {
            operation: 'API_INTEGRATION',
            api_integration_preference: {
              rest_api_integration: {
                integration_method: 'PAYPAL',
                integration_type: 'THIRD_PARTY',
                third_party_details: {
                  features: ['PAYMENT', 'REFUND', 'PARTNER_FEE']
                }
              }
            }
          }
        ],
        products: ['EXPRESS_CHECKOUT'],
        legal_consents: [
          {
            type: 'SHARE_DATA_CONSENT',
            granted: true
          }
        ]
      }
    });

    return response.data.links.find((link) => link.rel === 'action_url').href;
  } catch (error) {
    console.error('Error generating seller signup:', error?.response?.data || error);
    throw error;
  }
};
