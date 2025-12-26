import { GOOGLE_CALENDAR_CONFIG } from '../config/googleCalendarConfig.js';
import { google, Auth } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CALENDAR_CONFIG.clientId,
  GOOGLE_CALENDAR_CONFIG.clientSecret,
  GOOGLE_CALENDAR_CONFIG.redirectUri
);

/**
 * Generate the Google OAuth authorization URL
 * @param userId - The user ID to include in the state parameter
 * @returns The authorization URL
 */
export const generateAuthUrl = (userId: string): string => {
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get refresh token
    scope: GOOGLE_CALENDAR_CONFIG.scopes,
    prompt: 'consent', // Force consent screen to get refresh token
    state: state
  });
};

/**
 * Exchange authorization code for access and refresh tokens
 * @param code - The authorization code from Google
 * @returns Tokens and expiry information
 */
export const exchangeCodeForTokens = async (code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiryDate: Date | null;
}> => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error('Failed to get access token');
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null
    };
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw new Error('Failed to exchange authorization code for tokens');
  }
};

/**
 * Refresh an expired access token using the refresh token
 * @param refreshToken - The refresh token
 * @returns New access token and expiry information
 */
export const refreshAccessToken = async (refreshToken: string): Promise<{
  accessToken: string;
  expiryDate: Date | null;
}> => {
  try {
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    return {
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : null
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw new Error('Failed to refresh access token');
  }
};

/**
 * Check if a token is expired or will expire soon (within 5 minutes)
 * @param expiryDate - The token expiry date
 * @returns True if token is expired or expiring soon
 */
export const isTokenExpired = (expiryDate: Date | null | undefined): boolean => {
  if (!expiryDate) return true;
  
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return expiryDate <= fiveMinutesFromNow;
};

/**
 * Get a valid access token, refreshing if necessary
 * @param user - User object with Google Calendar tokens
 * @returns Valid access token
 */
export const getValidAccessToken = async (user: {
  googleCalendar?: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: Date;
  };
}): Promise<string> => {
  if (!user.googleCalendar?.accessToken) {
    throw new Error('No Google Calendar access token found');
  }

  // Check if token needs refresh
  if (isTokenExpired(user.googleCalendar.tokenExpiry)) {
    if (!user.googleCalendar.refreshToken) {
      throw new Error('Access token expired and no refresh token available');
    }

    // Refresh the token
    const { accessToken, expiryDate } = await refreshAccessToken(user.googleCalendar.refreshToken);
    
    // Note: The caller should update the user's tokens in the database
    // This function only returns the new token
    return accessToken;
  }

  return user.googleCalendar.accessToken;
};

/**
 * Get an authenticated OAuth2 client for making Google API calls
 * @param accessToken - The access token
 * @returns Authenticated OAuth2 client
 */
export const getAuthenticatedClient = (accessToken: string): Auth.OAuth2Client => {
  oauth2Client.setCredentials({
    access_token: accessToken
  });
  return oauth2Client;
};

