import express from 'express';
import googleCalendarWebhookHandler from '../handlers/googleCalendarWebhookHandler.js';

const router = express.Router();

// Google Calendar push notification webhook (no auth - called by Google)
router.post('/', googleCalendarWebhookHandler.handleWebhook);

export default router;
