import express from 'express';
import googleCalendarHandler from '../handlers/googleCalendarHandler.js';
import { verifyTokenMw, requireFeature } from '../../middleware/index.js';

const router = express.Router();

// Generate OAuth URL (requires auth + googleCalendar feature)
router.get('/connect', 
  verifyTokenMw, 
  requireFeature('googleCalendar'), 
  googleCalendarHandler.getAuthUrl
);

// OAuth callback (no auth required - handled by Google)
router.get('/callback', googleCalendarHandler.handleCallback);

// Disconnect calendar (requires auth + googleCalendar feature)
router.post('/disconnect', 
  verifyTokenMw, 
  requireFeature('googleCalendar'), 
  googleCalendarHandler.disconnect
);

// Get connection status (requires auth + googleCalendar feature)
router.get('/status', 
  verifyTokenMw, 
  requireFeature('googleCalendar'), 
  googleCalendarHandler.getStatus
);

// Sync calendar events to block time slots (requires auth + googleCalendar feature)
router.post('/sync', 
  verifyTokenMw, 
  requireFeature('googleCalendar'), 
  googleCalendarHandler.syncCalendar
);

export default router;

