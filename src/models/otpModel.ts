import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  attempts: {
    type: Number,
    default: 0,
  }
});

export const OTPModel = mongoose.model('OTP', otpSchema);
