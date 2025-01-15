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
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'  // This helps with PayPal responses
        }
      };
  
      if (body) {
        options.body = JSON.stringify(body);
      }
  
      try {
        const response = await fetch(`${BASE_URL}${path}`, options);
        
        // Handle specific response codes that don't return content
        if (response.status === 204) {
          return { success: true };
        }
        
        // Special handling for subscription cancellation
        if (path.includes('/cancel') && method === 'POST') {
          if (response.status === 204 || response.status === 200) {
            return { success: true };
          }
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorData: PayPalError;
          
          try {
            errorData = JSON.parse(errorText);
          } catch {
            throw new Error(`PayPal API request failed with status ${response.status}: ${errorText}`);
          }
          
          throw new Error(
            errorData.message || 
            errorData.details?.[0]?.description || 
            'PayPal API request failed'
          );
        }
  
        // Try to parse as JSON if possible
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return response.json();
        }
        
        // For non-JSON responses, return a success object
        return { success: true };
      } catch (error) {
        console.error('PayPal request error:', error);
        throw error;
      }
    }
  };