import axios from 'axios';

import { PAYPAL_BASE_URL, PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY } from '../../config/index.js';

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
  console.log('cart: ', cart);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2);
  console.log('total: ', total);

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
          items: [
            {
              name: 'Node.js Complete Course',
              description: 'Node.js Complete Course with Express and MongoDB',
              quantity: 1,
              unit_amount: {
                currency_code: 'USD',
                value: '100.00'
              }
            }
          ],

          amount: {
            currency_code: 'USD',
            value: '100.00',
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: '100.00'
              }
            }
          }
        }
      ],

      application_context: {
        return_url: PAYPAL_BASE_URL + '/complete-order',
        cancel_url: PAYPAL_BASE_URL + '/cancel-order',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        brand_name: 'Studioz'
      }
    })
  });
  console.log('response.data: ', response.data);
  return { id: response.data.id };
  //   return response.data.links.find((link) => link.rel === 'approve').href;
};

export const capturePayment = async (orderId) => {
  console.log('orderId: ', orderId);
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
