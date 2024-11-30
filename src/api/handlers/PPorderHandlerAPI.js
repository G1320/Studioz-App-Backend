import axios from 'axios';

import { BASE_URL, PAYPAL_BASE_URL, PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY } from '../../config/index.js';

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
      currency_code: 'USD',
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
            currency_code: 'USD',
            value: total,
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: total
              }
            }
          }
        }
      ],
      application_context: {
        return_url: BASE_URL + '/complete-order',
        cancel_url: BASE_URL + '/cancel-order',
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
