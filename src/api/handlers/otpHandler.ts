import { Request, Response } from 'express';
import { OTPService } from '../../services/otpService.js';

export class OTPHandler {
  static async sendOTP(req: Request, res: Response) {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      const sent = await OTPService.sendVerificationOTP(phoneNumber);
      
      if (sent) {
        res.json({ success: true, message: 'Verification code sent' });
      } else {
        res.status(400).json({ error: 'Failed to send verification code' });
      }
    } catch (error) {
      console.error('Error sending verification code:', error);
      res.status(500).json({ error: 'Failed to send verification code' });
    }
  }

  static async verifyOTP(req: Request, res: Response) {
    try {
      const { phoneNumber, code } = req.body;

      if (!phoneNumber || !code) {
        return res.status(400).json({ 
          error: 'Phone number and verification code are required' 
        });
      }

      const isVerified = await OTPService.verifyPhoneNumber(phoneNumber, code);

      if (isVerified) {
        res.json({ 
          success: true, 
          verified: true, 
          message: 'Phone number verified successfully' 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          verified: false,
          error: 'Invalid or expired verification code' 
        });
      }
    } catch (error) {
      console.error('Error verifying phone number:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  }
}