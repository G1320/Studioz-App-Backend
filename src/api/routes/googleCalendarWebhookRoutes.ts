import express from 'express';
import { handleGoogleCalendarWebhook } from '../handlers/googleCalendarWebhookHandler.js';

const router = express.Router();

// Test endpoint to verify webhook route is accessible
router.get('/google-calendar/test', (req, res) => {
  res.status(200).json({ 
    message: 'Google Calendar webhook endpoint is accessible',
    url: '/api/webhooks/google-calendar',
    method: 'POST'
  });
});

// Google Calendar webhook endpoint (no auth required - Google sends notifications here)
// Note: In production, you should verify the webhook signature for security
router.post('/google-calendar', handleGoogleCalendarWebhook);

export default router;
