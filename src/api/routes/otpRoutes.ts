import express from 'express';
import { OTPHandler } from '../handlers/otpHandler.js';
import rateLimit from 'express-rate-limit';
import { rateLimitKey } from '../../middleware/rateLimitKey.js';
 
const router = express.Router();

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // limit each IP to 3 OTP requests per windowMs
    keyGenerator: rateLimitKey,
    message: 'Too many OTP requests from this IP, please try again after 15 minutes',
  });

router.post('/send', otpLimiter, OTPHandler.sendOTP);
router.post('/verify', OTPHandler.verifyOTP);

export default router;