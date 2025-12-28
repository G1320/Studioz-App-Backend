import { Request, Response } from 'express';
import handleRequest from '../../utils/requestHandler.js';
import ExpressError from '../../utils/expressError.js';
import {
  connectCalendar,
  disconnectCalendar,
  getConnectionStatus,
  syncCalendarEventsToTimeSlots
} from '../../services/googleCalendarService.js';
import { UserModel } from '../../models/userModel.js';
import { generateAuthUrl } from '../../utils/googleOAuthUtils.js';

interface CustomRequest extends Request {
  decodedJwt?: {
    _id?: string;
    userId?: string;
    sub?: string;
  };
}

/**
 * Generate Google OAuth authorization URL
 * GET /api/auth/google/calendar/connect
 */
const getAuthUrl = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?._id || req.decodedJwt?.userId;
  if (!userId) {
    throw new ExpressError('User not authenticated', 401);
  }

  const authUrl = generateAuthUrl(userId.toString());
  return { authUrl };
});

/**
 * Handle Google OAuth callback
 * GET /api/auth/google/calendar/callback
 * Note: This handler doesn't use handleRequest because it needs to redirect
 */
const handleCallback = async (req: Request, res: Response, next: Function) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      throw new ExpressError('Authorization code not provided', 400);
    }

    if (!state || typeof state !== 'string') {
      throw new ExpressError('State parameter not provided', 400);
    }

    // Decode state to get userId
    let userId: string;
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = decodedState.userId;
    } catch (error) {
      throw new ExpressError('Invalid state parameter', 400);
    }

    // Connect calendar
    await connectCalendar(userId, code);

    // Redirect to frontend success page
    const { FRONTEND_URL } = await import('../../config/index.js');
    const redirectUrl = FRONTEND_URL || 'https://studioz.co.il';
    console.log('Redirecting to:', `${redirectUrl}/dashboard?calendar=connected`);
    res.redirect(`${redirectUrl}/dashboard?calendar=connected`);
  } catch (error) {
    console.error('Error in Google Calendar callback:', error);
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    // Send error response instead of using next() to avoid double error handling
    if (error instanceof ExpressError) {
      res.status(error.statusCode || 500).json({ 
        message: error.message,
        error: 'Failed to connect Google Calendar'
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to connect Google Calendar',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Disconnect Google Calendar
 * POST /api/auth/google/calendar/disconnect
 */
const disconnect = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?._id || req.decodedJwt?.userId;
  if (!userId) {
    throw new ExpressError('User not authenticated', 401);
  }

  await disconnectCalendar(userId.toString());
  return { message: 'Google Calendar disconnected successfully' };
});

/**
 * Get Google Calendar connection status
 * GET /api/auth/google/calendar/status
 */
const getStatus = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?._id || req.decodedJwt?.userId;
  if (!userId) {
    throw new ExpressError('User not authenticated', 401);
  }

  const status = await getConnectionStatus(userId.toString());
  return status;
});

/**
 * Sync calendar events to block time slots
 * POST /api/auth/google/calendar/sync
 */
const syncCalendar = handleRequest(async (req: CustomRequest) => {
  const userId = req.decodedJwt?._id || req.decodedJwt?.userId;
  if (!userId) {
    throw new ExpressError('User not authenticated', 401);
  }

  const user = await UserModel.findById(userId).select('googleCalendar');
  
  if (!user || !user.googleCalendar?.connected) {
    throw new ExpressError('Google Calendar not connected', 400);
  }

  const syncToken = user.googleCalendar.syncToken;
  const newSyncToken = await syncCalendarEventsToTimeSlots(userId.toString(), syncToken || undefined);
  
  return { 
    message: 'Calendar synced successfully',
    syncToken: newSyncToken 
  };
});

const googleCalendarHandler = {
  getAuthUrl,
  handleCallback, // No auth required - handled by Google OAuth
  disconnect,
  getStatus,
  syncCalendar
};

export default googleCalendarHandler;

