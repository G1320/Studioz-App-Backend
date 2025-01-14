// routes/otpRoutes.ts
import express from 'express';
import { OTPController } from '../handlers/otpHandler.js';

const router = express.Router();

router.post('/send', OTPController.sendOTP);
router.post('/verify', OTPController.verifyOTP);

export default router;