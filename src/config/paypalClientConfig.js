import { Client, Environment, LogLevel } from '@paypal/paypal-server-sdk';

const { PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY } = process.env;

export const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: PAYPAL_CLIENT_ID,
    oAuthClientSecret: PAYPAL_SECRET_KEY
  },
  timeout: 0,
  environment: Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Error,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true }
  }
});
