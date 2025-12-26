import { Request, Response } from 'express';
import handleRequest from '../../utils/requestHandler.js';
import ExpressError from '../../utils/expressError.js';
import {
  connectCalendar,
  disconnectCalendar,
  getConnectionStatus
} from '../../services/googleCalendarService.js';
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
    res.redirect(`${FRONTEND_URL}/dashboard?calendar=connected`);
  } catch (error) {
    console.error('Error in Google Calendar callback:', error);
    next(error);
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

const googleCalendarHandler = {
  getAuthUrl,
  handleCallback, // No auth required - handled by Google OAuth
  disconnect,
  getStatus
};

export default googleCalendarHandler;

