import express from 'express';
import googleCalendarHandler from '../handlers/googleCalendarHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

// Generate OAuth URL (requires auth)
router.get('/connect', verifyTokenMw, googleCalendarHandler.getAuthUrl);

// OAuth callback (no auth required - handled by Google)
router.get('/callback', googleCalendarHandler.handleCallback);

// Disconnect calendar (requires auth)
router.post('/disconnect', verifyTokenMw, googleCalendarHandler.disconnect);

// Get connection status (requires auth)
router.get('/status', verifyTokenMw, googleCalendarHandler.getStatus);

export default router;

