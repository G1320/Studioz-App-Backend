import axios from 'axios';

import {
  PAYPAL_LIVE_CLIENT_ID,
  PAYPAL_LIVE_SECRET_KEY,
  PAYPAL_SANDBOX_BASE_URL,
  PAYPAL_SANDBOX_CLIENT_ID,
  PAYPAL_SANDBOX_SECRET_KEY
} from '../../config/index.js';

const isProduction = process.env.NODE_ENV === 'production';

export async function generateAccessToken() {
  const response = await axios({
    url: PAYPAL_SANDBOX_BASE_URL + '/v1/oauth2/token',
    method: 'post',
    data: 'grant_type=client_credentials',
    auth: {
      username: isProduction ? PAYPAL_LIVE_CLIENT_ID : PAYPAL_SANDBOX_CLIENT_ID,
      password: isProduction ? PAYPAL_LIVE_SECRET_KEY : PAYPAL_SANDBOX_SECRET_KEY
    }
  });

  return response.data.access_token;
}
