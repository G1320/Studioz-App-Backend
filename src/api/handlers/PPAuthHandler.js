import axios from 'axios';

import {
  NODE_ENV,
  PAYPAL_LIVE_BASE_URL,
  PAYPAL_LIVE_CLIENT_ID,
  PAYPAL_LIVE_SECRET_KEY,
  PAYPAL_SANDBOX_BASE_URL,
  PAYPAL_SANDBOX_CLIENT_ID,
  PAYPAL_SANDBOX_SECRET_KEY
} from '../../config/index.js';

// const isProduction = NODE_ENV === 'production';
const isProduction = false;
const PAYPAL_BASE_URL = isProduction ? PAYPAL_LIVE_BASE_URL : PAYPAL_SANDBOX_BASE_URL;
const PAYPAL_CLIENT_ID = isProduction ? PAYPAL_LIVE_CLIENT_ID : PAYPAL_SANDBOX_CLIENT_ID;
const PAYPAL_SECRET_KEY = isProduction ? PAYPAL_LIVE_SECRET_KEY : PAYPAL_SANDBOX_SECRET_KEY;

import qs from 'qs';

export async function generateAccessToken() {
  try {
    // Prepare Authorization header with Base64 encoding of CLIENT_ID:CLIENT_SECRET
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET_KEY}`).toString('base64');

    // Set up request headers
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`
    };

    // Prepare body data: client_credentials grant type
    const body = qs.stringify({
      grant_type: 'client_credentials'
    });

    // Send POST request to PayPal to get the access token
    const response = await axios.post(`${PAYPAL_BASE_URL}/v1/oauth2/token`, body, { headers });

    // The access token is inside the response data
    const accessToken = response.data.access_token;

    return accessToken;
  } catch (error) {
    console.error('Error fetching access token:', error.message);
    return null;
  }
}

// export async function generateAccessToken() {
//   try {
//     const response = await axios({
//       url: `${PAYPAL_BASE_URL}` + '/v1/oauth2/token',
//       method: 'post',
//       data: 'grant_type=client_credentials',
//       auth: {
//         username: PAYPAL_CLIENT_ID,
//         password: PAYPAL_SECRET_KEY
//       }
//     });
//     return response.data.access_token;
//   } catch (error) {
//     console.error('Error generating access token:', error);
//   }
// }
