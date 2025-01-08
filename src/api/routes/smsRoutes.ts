// routes/smsRoutes.ts
import express from 'express';
import { sendBookingConfirmation } from '../handlers/smsHandler.js'
import rateLimit from 'express-rate-limit';

const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 SMS requests per windowMs
  message: 'Too many SMS requests from this IP, please try again after 15 minutes'
});

const router = express.Router();

// Apply rate limiting to all SMS routes
router.use(smsLimiter);

router.post('/send-booking-confirmation', async (req, res) => {
  try {
    const { phoneNumber, bookingDetails } = req.body;

    if (!phoneNumber || !bookingDetails) {
      return res.status(400).json({ error: 'Phone number and booking details are required' });
    }

    // Validate phone number
    const phoneRegex = /^(\+972|972|0)([23489]|5[0-9]|77)[0-9]{7}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid Israeli phone number' });
    }

    const response = await sendBookingConfirmation(phoneNumber, bookingDetails);
    
    res.status(200).json({ 
      message: 'Booking confirmation SMS sent successfully',
      response 
    });
  } catch (error) {
    console.error('Error sending booking confirmation SMS:', error);
    res.status(500).json({ error: 'Failed to send booking confirmation SMS' });
  }
});

export default router;