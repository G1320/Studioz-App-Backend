import axios from 'axios';

import { PAYPAL_BASE_URL } from '../../config/index.js';
import { generateAccessToken } from './PPAuthHandler.js';

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

  // First get the order details
  const orderDetails = await axios({
    url: `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`,
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  });

  // Then capture the payment
  const captureResponse = await axios({
    url: PAYPAL_BASE_URL + `/v2/checkout/orders/${orderId}/capture`,
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken
    }
  });

  const response = {
    ...captureResponse.data,
    purchase_units: orderDetails.data.purchase_units,
    create_time: orderDetails.data.create_time,
    update_time: captureResponse.data.update_time
  };

  return response;
};

export const getOrderDetails = async (orderId) => {
  try {
    // Get the order details from PayPal
    const accessToken = await generateAccessToken();
    const response = await axios({
      url: `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`,
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
      merchantName: orderData.purchase_units[0].payee.merchant_id, // You might want to look up the actual name
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
  const platformFee = calculateMarketplaceFee(total).platformFee;

  const items = cart.map((item) => ({
    name: item.name,
    quantity: item.quantity || 1,
    unit_amount: {
      currency_code: 'ILS',
      value: item.price.toString()
    },
    description: item.description || '',
    category: 'DIGITAL_GOODS'
  }));

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
          items: items,
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
            merchant_id: merchantId
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
