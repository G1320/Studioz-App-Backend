import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const JWT_REFRESH_KEY = process.env.JWT_REFRESH_KEY;
const NODE_ENV = process.env.NODE_ENV;
const DB_URL = process.env.DB_URL;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET_KEY = process.env.PAYPAL_SECRET_KEY;
const PAYPAL_PARTNER_ID = process.env.PAYPAL_PARTNER_ID;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL;
const BASE_URL = process.env.BASE_URL;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

export { PORT,BASE_URL, ALLOWED_ORIGINS, JWT_SECRET_KEY, JWT_REFRESH_KEY, NODE_ENV, DB_URL, PAYPAL_CLIENT_ID,PAYPAL_PARTNER_ID, PAYPAL_SECRET_KEY, PAYPAL_BASE_URL, BREVO_API_KEY  };
