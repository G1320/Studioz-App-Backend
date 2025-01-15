import fetch from 'node-fetch';
import { generateAccessToken } from '../api/handlers/PPAuthHandler.js';

const isProduction = false;

const BASE_URL = isProduction
  ? 'https://api.paypal.com'
  : 'https://api.sandbox.paypal.com';

interface PayPalError {
  message?: string;
  name?: string;
  details?: Array<{
    issue: string;
    description: string;
  }>;
}

export const paypalClient = {
  async request(path: string, method = 'GET', body?: any): Promise<any> {
    const accessToken = await generateAccessToken();
    
    const options: any = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, options);
    if (!response.ok) {
      const errorData = await response.json() as PayPalError;
      throw new Error(
        errorData.message || 
        errorData.details?.[0]?.description || 
        'PayPal API request failed'
      );
    }

    return response.json();
  }
};