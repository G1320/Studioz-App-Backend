require('dotenv').config();

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS.split(',');
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const JWT_REFRESH_KEY = process.env.JWT_REFRESH_KEY;
const NODE_ENV = process.env.NODE_ENV;
const DB_URL = process.env.DB_URL;

module.exports = {
  PORT,
  ALLOWED_ORIGINS,
  JWT_SECRET_KEY,
  JWT_REFRESH_KEY,
  NODE_ENV,
  DB_URL,
};
