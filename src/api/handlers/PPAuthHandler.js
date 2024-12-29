import axios from 'axios';

import { PAYPAL_BASE_URL, PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY } from '../../config/index.js';

export async function generateAccessToken() {
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
