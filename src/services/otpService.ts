import { OTPModel } from '../models/otpModel.js';
import { sendSMS } from '../api/handlers/smsHandler.js';

export class OTPService {
  private static OTP_EXPIRY_MINUTES = 10;
  private static MAX_ATTEMPTS = 3;

  static async sendVerificationOTP(phoneNumber: string): Promise<boolean> {
    try {
      // Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

      await OTPModel.deleteMany({ phoneNumber });

      await OTPModel.create({
        code,
        phoneNumber,
        expiresAt,
        verified: false,
        attempts: 0
      });

      await sendSMS({
        phoneNumber,
        message: `Your StudioZ verification code is: ${code}`
      });

      return true;
    } catch (error) {
      console.error('Error sending verification code:', error);
      throw error;
    }
  }

  static async verifyPhoneNumber(phoneNumber: string, code: string): Promise<boolean> {
    try {
      const otpRecord = await OTPModel.findOne({ phoneNumber });

      if (!otpRecord || otpRecord.verified || 
          new Date() > otpRecord.expiresAt || 
          otpRecord.attempts >= this.MAX_ATTEMPTS) {
        return false;
      }

      // Increment attempts
      otpRecord.attempts += 1;
      await otpRecord.save();

      if (otpRecord.code !== code) {
        return false;
      }

      // Mark as verified
      otpRecord.verified = true;
      await otpRecord.save();

      return true;
    } catch (error) {
      console.error('Error verifying phone:', error);
      throw error;
    }
  }
}