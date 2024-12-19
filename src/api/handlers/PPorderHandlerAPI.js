import axios from 'axios';

import { paypalClient } from '../../config/paypalClientConfig.js';

import {
  BASE_URL,
  PAYPAL_BASE_URL,
  PAYPAL_PARTNER_ID,
  PAYPAL_CLIENT_ID,
  PAYPAL_SECRET_KEY
} from '../../config/index.js';

const calculateTotal = (cart) => {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2);
};

const calculatePlatformFee = (total) => {
  return (total * 0.12).toFixed(2);
};

async function generateAccessToken() {
  const response = await axios({
    url: PAYPAL_BASE_URL + '/v1/oauth2/token',
    method: 'post',
    data: 'grant_type=client_credentials',
    auth: {
      username: PAYPAL_CLIENT_ID,
      password: PAYPAL_SECRET_KEY
    }
  });

  return response.data.access_token;
}
export const createOrder = async (cart) => {
  const accessToken = await generateAccessToken();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2);

  const formattedItems = cart.map((item) => ({
    name: item.name,
    description: item.description || 'Studio Service',
    quantity: item.quantity,
    unit_amount: {
      currency_code: 'ILS',
      value: item.price.toString()
    }
  }));

  const response = await axios({
    url: PAYPAL_BASE_URL + '/v2/checkout/orders',
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken
    },
    data: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          items: formattedItems,
          amount: {
            currency_code: 'ILS',
            value: total,
            breakdown: {
              item_total: {
                currency_code: 'ILS',
                value: total
              }
            }
          }
        }
      ],
      application_context: {
        return_url: BASE_URL + '/orders/complete-order',
        cancel_url: BASE_URL + '/orders/cancel-order',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        brand_name: 'Studioz'
      }
    })
  });
  return { id: response.data.id };
};

export const capturePayment = async (orderId) => {
  const accessToken = await generateAccessToken();

  const response = await axios({
    url: PAYPAL_BASE_URL + `/v2/checkout/orders/${orderId}/capture`,
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken
    }
  });

  return response.data;
};

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
          return_url: `${BASE_URL}/orders/seller/onboard-complete/${sellerId}`
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

export const createMarketplaceOrder = async (cart, sellerId) => {
  const accessToken = await generateAccessToken();
  const total = calculateTotal(cart);
  const platformFee = calculatePlatformFee(total);

  const response = await axios({
    url: `${PAYPAL_BASE_URL}/v2/checkout/orders`,
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    data: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: 'STUDIO_PURCHASE',
          amount: {
            currency_code: 'ILS',
            value: total.toString(),
            breakdown: {
              item_total: {
                currency_code: 'ILS',
                value: total.toString()
              },
              platform_fees: {
                currency_code: 'ILS',
                value: platformFee.toString()
              }
            }
          },
          payee: {
            merchant_id: sellerId
          },
          payment_instruction: {
            platform_fees: [
              {
                amount: {
                  currency_code: 'ILS',
                  value: platformFee.toString()
                }
              }
            ],
            disbursement_mode: 'INSTANT'
          }
        }
      ]
    }
  });

  return response.data;
};

export const processPayout = async (sellerId, amount) => {
  const accessToken = await generateAccessToken();

  try {
    const response = await axios({
      url: `${PAYPAL_BASE_URL}/v1/payments/payouts`,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      data: {
        sender_batch_header: {
          sender_batch_id: `PAYOUT_${Date.now()}`,
          email_subject: 'You have a payout!',
          email_message: 'You have received a payout from your studio bookings'
        },
        items: [
          {
            recipient_type: 'PAYPAL_ID',
            amount: {
              value: amount.toString(),
              currency: 'ILS'
            },
            receiver: sellerId,
            note: 'Payout for studio bookings',
            sender_item_id: `PAYOUT_ITEM_${Date.now()}`
          }
        ]
      }
    });

    return response.data;
  } catch (error) {
    console.error('Payout failed:', error);
    throw error;
  }
};
