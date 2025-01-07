import axios from 'axios';

import {
  NODE_ENV,
  PAYPAL_LIVE_BASE_URL,
  PAYPAL_LIVE_PARTNER_ID,
  PAYPAL_LIVE_PLATFORM_MERCHANT_ID,
  PAYPAL_SANDBOX_BASE_URL,
  PAYPAL_SANDBOX_PARTNER_ID,
  PAYPAL_SANDBOX_PLATFORM_MERCHANT_ID
} from '../../config/index.js';
import { generateAccessToken } from './PPAuthHandler.js';

const isProduction = process.env.NODE_ENV === 'production';
const currency = isProduction ? 'ILS' : 'USD';

const calculateTotal = (cart) => {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2);
};

export const calculateMarketplaceFee = (total) => {
  const platformFee = parseFloat((total * 0.12).toFixed(2));
  const sellerAmount = parseFloat((total - platformFee).toFixed(2));

  return {
    platformFee,
    sellerAmount
  };
};

export const capturePayment = async (orderId) => {
  const accessToken = await generateAccessToken();
  try {
    // First get the order details
    const orderDetails = await axios({
      url: `${isProduction ? PAYPAL_LIVE_BASE_URL : PAYPAL_SANDBOX_BASE_URL}/v2/checkout/orders/${orderId}`,
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Partner-Attribution-Id': isProduction ? PAYPAL_LIVE_PARTNER_ID : PAYPAL_SANDBOX_PARTNER_ID
      }
    });

    // Then capture the payment
    const captureResponse = await axios({
      url: isProduction ? PAYPAL_LIVE_BASE_URL : PAYPAL_SANDBOX_BASE_URL + `/v2/checkout/orders/${orderId}/capture`,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
        'PayPal-Partner-Attribution-Id': isProduction ? PAYPAL_LIVE_PARTNER_ID : PAYPAL_SANDBOX_PARTNER_ID
      }
    });

    const response = {
      ...captureResponse.data,
      purchase_units: orderDetails.data.purchase_units,
      create_time: orderDetails.data.create_time,
      update_time: captureResponse.data.update_time
    };

    return response;
  } catch (error) {
    console.error('Capture failed:', error.response?.data || error);
    throw error;
  }
};

export const getOrderDetails = async (orderId) => {
  try {
    // Get the order details from PayPal
    const accessToken = await generateAccessToken();
    const response = await axios({
      url: `${isProduction ? PAYPAL_LIVE_BASE_URL : PAYPAL_SANDBOX_BASE_URL}/v2/checkout/orders/${orderId}`,
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      }
    });

    const orderData = response.data;

    // Format the response
    const formattedOrder = {
      orderId: orderData.id,
      createTime: orderData.create_time,
      merchantName: orderData.purchase_units[0].payee.merchant_id,
      items:
        orderData.purchase_units[0].items?.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.unit_amount.value
        })) || [],
      total: orderData.purchase_units[0].amount.value,
      paymentStatus: orderData.status,
      payerEmail: orderData.payer.email_address,
      transactionId: orderData.purchase_units[0].payments?.captures[0]?.id
    };

    res.json(formattedOrder);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      error: 'Failed to fetch order details',
      details: error.message
    });
  }
};

export const createMarketplaceOrder = async (cart, merchantId) => {
  const accessToken = await generateAccessToken();
  const total = calculateTotal(cart);
  const fees = calculateMarketplaceFee(total);

  const items = cart.map((item) => ({
    name: item.name,
    quantity: item.quantity || 1,
    unit_amount: {
      currency_code: currency,
      value: item.price.toString()
    },
    description: item.description || '',
    category: 'DIGITAL_GOODS'
  }));

  const response = await axios({
    url: `${isProduction ? PAYPAL_LIVE_BASE_URL : PAYPAL_SANDBOX_BASE_URL}/v2/checkout/orders`,
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'PayPal-Partner-Attribution-Id': isProduction ? PAYPAL_LIVE_PARTNER_ID : PAYPAL_SANDBOX_PARTNER_ID
    },
    data: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: 'STUDIO_PURCHASE',
          items: items,
          amount: {
            currency_code: currency,
            value: total.toString(),
            breakdown: {
              item_total: {
                currency_code: currency,
                value: total.toString()
              },
              platform_fees: {
                currency_code: currency,
                value: fees.platformFee.toString()
              }
            }
          },
          payee: {
            merchant_id: merchantId,
            email_message: 'You have received a payment for your studio booking!',
            email_subject: 'New Studio Booking Payment'
          },
          payment_instruction: {
            disbursement_mode: 'INSTANT',
            platform_fees: [
              {
                amount: {
                  currency_code: currency,
                  value: fees.platformFee.toString()
                },
                payee: {
                  merchant_id: isProduction ? PAYPAL_LIVE_PLATFORM_MERCHANT_ID : PAYPAL_SANDBOX_PLATFORM_MERCHANT_ID
                },
                description: 'Platform fee for service'
              }
            ],
            disbursement_options: {
              delayed_disbursement_date: 'NO_DELAY'
            }
          }
        }
      ],
      application_context: {
        shipping_preference: 'NO_SHIPPING',
        platform_fees_reason: 'Platform service fee'
      }
    }
  });

  return response.data;
};
