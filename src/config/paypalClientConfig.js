import { Client, Environment, LogLevel } from '@paypal/paypal-server-sdk';

const {
  PAYPAL_LIVE_CLIENT_ID,
  PAYPAL_SANDBOX_SUBSCRIPTION_CLIENT_ID,
  PAYPAL_SANDBOX_SUBSCRIPTION_SECRET_KEY,
  PAYPAL_LIVE_SECRET_KEY
} = process.env;

// const isProduction = process.env.NODE_ENV === 'production';
const isProduction = false;

const CLIENT_ID = isProduction ? PAYPAL_LIVE_CLIENT_ID : PAYPAL_SANDBOX_SUBSCRIPTION_CLIENT_ID;
const CLIENT_SECRET = isProduction ? PAYPAL_LIVE_SECRET_KEY : PAYPAL_SANDBOX_SUBSCRIPTION_SECRET_KEY;
const ENVIRONMENT = isProduction ? Environment.Live : Environment.Sandbox;

export const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: CLIENT_ID,
    oAuthClientSecret: CLIENT_SECRET
  },
  timeout: 0,
  environment: ENVIRONMENT,
  logging: {
    logLevel: LogLevel.Error,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true }
  }
});
