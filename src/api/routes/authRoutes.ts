import express from 'express';
import rateLimit from 'express-rate-limit';
import authHandler from '../handlers/authHandler.js';
import { rateLimitKey, validateUser } from '../../middleware/index.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { error: 'Too many attempts, please try again later' }
});

// The app calls /login on every fresh session, so only failures count toward the limit.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts, please try again later' }
});

router.post('/register', authLimiter, validateUser, authHandler.createAndRegisterUser);
router.post('/login', loginLimiter, authHandler.loginUser);
router.post('/refresh-token', authHandler.refreshAccessToken);
router.post('/logout', authHandler.logoutUser);

export default router;
