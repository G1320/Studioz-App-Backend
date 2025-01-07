import axios from 'axios';

import {
  PAYPAL_LIVE_BASE_URL,
  PAYPAL_LIVE_CLIENT_ID,
  PAYPAL_LIVE_SECRET_KEY,
  PAYPAL_SANDBOX_BASE_URL,
  PAYPAL_SANDBOX_CLIENT_ID,
  PAYPAL_SANDBOX_SECRET_KEY
} from '../../config/index.js';

const isProduction = process.env.NODE_ENV === 'production';
const PAYPAL_BASE_URL = isProduction ? PAYPAL_LIVE_BASE_URL : PAYPAL_SANDBOX_BASE_URL;
const PAYPAL_CLIENT_ID = isProduction ? PAYPAL_LIVE_CLIENT_ID : PAYPAL_SANDBOX_CLIENT_ID;
const PAYPAL_SECRET_KEY = isProduction ? PAYPAL_LIVE_SECRET_KEY : PAYPAL_SANDBOX_SECRET_KEY;

export async function generateAccessToken() {
  try {
    const response = await axios({
      url: `${PAYPAL_BASE_URL}` + '/v1/oauth2/token',
      method: 'post',
      data: 'grant_type=client_credentials',
      auth: {
        username: PAYPAL_CLIENT_ID,
        password: PAYPAL_SECRET_KEY
      }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error generating access token:', error);
  }
}
