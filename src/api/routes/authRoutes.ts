import express from 'express';
import rateLimit from 'express-rate-limit';
import authHandler from '../handlers/authHandler.js';
import { validateUser } from '../../middleware/index.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' }
});

router.post('/register', authLimiter, validateUser, authHandler.createAndRegisterUser);
router.post('/login', authLimiter, authHandler.loginUser);
router.post('/refresh-token', authHandler.refreshAccessToken);
router.post('/logout', authHandler.logoutUser);

export default router;
