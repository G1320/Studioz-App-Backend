import express from 'express';
import { handleGoogleCalendarWebhook } from '../handlers/googleCalendarWebhookHandler.js';

const router = express.Router();

// Google Calendar webhook endpoint (no auth required - Google sends notifications here)
// Note: In production, you should verify the webhook signature for security
router.post('/google-calendar', handleGoogleCalendarWebhook);

export default router;
