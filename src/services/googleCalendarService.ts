import { google, calendar_v3 } from 'googleapis';
import { UserModel } from '../models/userModel.js';
import { StudioModel } from '../models/studioModel.js';
import { ItemModel } from '../models/itemModel.js';
import { ReservationModel } from '../models/reservationModel.js';
import { getValidAccessToken, getAuthenticatedClient, isTokenExpired, refreshAccessToken } from '../utils/googleOAuthUtils.js';
import { formatReservationToCalendarEvent } from '../utils/googleCalendarUtils.js';
import ExpressError from '../utils/expressError.js';
import Reservation from '../types/reservation.js';

/**
 * Helper function to get and refresh access token if needed
 * Updates user in database if token was refreshed
 */
const getAndRefreshToken = async (userId: string, user: any): Promise<string> => {
  let accessToken = user.googleCalendar.accessToken;
  
  // Check if token needs refresh
  if (isTokenExpired(user.googleCalendar.tokenExpiry) && user.googleCalendar.refreshToken) {
    const { accessToken: newToken, expiryDate } = await refreshAccessToken(
      user.googleCalendar.refreshToken
    );
    await UserModel.findByIdAndUpdate(userId, {
      'googleCalendar.accessToken': newToken,
      'googleCalendar.tokenExpiry': expiryDate
    });
    accessToken = newToken;
  }
  
  return accessToken;
};

/**
 * Connect user's Google Calendar
 * @param userId - User ID
 * @param authCode - Authorization code from Google OAuth callback
 */
export const connectCalendar = async (userId: string, authCode: string): Promise<void> => {
  try {
    console.log('Connecting Google Calendar for user:', userId);
    const { exchangeCodeForTokens } = await import('../utils/googleOAuthUtils.js');
    const { accessToken, refreshToken, expiryDate } = await exchangeCodeForTokens(authCode);

    if (!refreshToken) {
      throw new ExpressError('Failed to get refresh token. Please try again.', 400);
    }

    console.log('Tokens received, updating user in database...');
    // Update user with Google Calendar tokens
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        'googleCalendar.connected': true,
        'googleCalendar.accessToken': accessToken,
        'googleCalendar.refreshToken': refreshToken,
        'googleCalendar.tokenExpiry': expiryDate,
        'googleCalendar.calendarId': 'primary',
        'googleCalendar.lastSyncAt': new Date()
      },
      { new: true }
    );

    if (!updatedUser) {
      throw new ExpressError('User not found', 404);
    }

    console.log('User updated successfully');
    // Note: We skip calendar list verification since it requires the full 'calendar' scope
    // The connection will be verified when we actually create an event
    console.log('Google Calendar connected successfully');

  } catch (error) {
    console.error('Error connecting Google Calendar:', error);
    if (error instanceof ExpressError) {
      throw error;
    }
    // Provide more detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new ExpressError(`Failed to connect Google Calendar: ${errorMessage}`, 500);
  }
};

/**
 * Disconnect user's Google Calendar
 * @param userId - User ID
 */
export const disconnectCalendar = async (userId: string): Promise<void> => {
  try {
    await UserModel.findByIdAndUpdate(userId, {
      $unset: {
        'googleCalendar': ''
      }
    });
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    throw new ExpressError('Failed to disconnect Google Calendar', 500);
  }
};

/**
 * Get user's Google Calendar connection status
 * @param userId - User ID
 * @returns Connection status
 */
export const getConnectionStatus = async (userId: string): Promise<{
  connected: boolean;
  lastSyncAt?: Date;
}> => {
  try {
    const user = await UserModel.findById(userId).select('googleCalendar');
    
    if (!user || !user.googleCalendar?.connected) {
      return { connected: false };
    }

    return {
      connected: true,
      lastSyncAt: user.googleCalendar.lastSyncAt || undefined
    };
  } catch (error) {
    console.error('Error getting connection status:', error);
    return { connected: false };
  }
};

/**
 * Create a calendar event for a reservation
 * @param userId - User ID (studio owner)
 * @param reservation - Reservation object
 * @returns Calendar event ID
 */
export const createCalendarEvent = async (
  userId: string,
  reservation: Reservation
): Promise<string> => {
  try {
    // Get user with Google Calendar tokens
    const user = await UserModel.findById(userId).select('googleCalendar');
    
    if (!user || !user.googleCalendar?.connected) {
      throw new ExpressError('Google Calendar not connected', 400);
    }

    // Get and refresh token if needed
    const accessToken = await getAndRefreshToken(userId, user);

    // Get studio and item data
    const studio = await StudioModel.findById(reservation.studioId);
    if (!studio) {
      throw new ExpressError('Studio not found', 404);
    }

    const item = await ItemModel.findById(reservation.itemId);

    // Format reservation to calendar event
    const event = formatReservationToCalendarEvent(reservation, studio, item || undefined);

    // Create calendar client
    const calendar = google.calendar({ version: 'v3', auth: getAuthenticatedClient(accessToken) });

    // Insert event into calendar
    const calendarId = user.googleCalendar.calendarId || 'primary';
    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: event
    });

    if (!response.data.id) {
      throw new ExpressError('Failed to create calendar event', 500);
    }

    // Update last sync time
    await UserModel.findByIdAndUpdate(userId, {
      'googleCalendar.lastSyncAt': new Date()
    });

    return response.data.id;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    if (error instanceof ExpressError) {
      throw error;
    }
    throw new ExpressError('Failed to create calendar event', 500);
  }
};

/**
 * Update a calendar event for a reservation
 * @param userId - User ID (studio owner)
 * @param eventId - Calendar event ID
 * @param reservation - Updated reservation object
 */
export const updateCalendarEvent = async (
  userId: string,
  eventId: string,
  reservation: Reservation
): Promise<void> => {
  try {
    // Get user with Google Calendar tokens
    const user = await UserModel.findById(userId).select('googleCalendar');
    
    if (!user || !user.googleCalendar?.connected) {
      throw new ExpressError('Google Calendar not connected', 400);
    }

    // Get and refresh token if needed
    const accessToken = await getAndRefreshToken(userId, user);

    // Get studio and item data
    const studio = await StudioModel.findById(reservation.studioId);
    if (!studio) {
      throw new ExpressError('Studio not found', 404);
    }

    const item = await ItemModel.findById(reservation.itemId);

    // Format reservation to calendar event
    const event = formatReservationToCalendarEvent(reservation, studio, item || undefined);

    // Create calendar client
    const calendar = google.calendar({ version: 'v3', auth: getAuthenticatedClient(accessToken) });

    // Update event
    const calendarId = user.googleCalendar.calendarId || 'primary';
    await calendar.events.update({
      calendarId: calendarId,
      eventId: eventId,
      requestBody: event
    });

    // Update last sync time
    await UserModel.findByIdAndUpdate(userId, {
      'googleCalendar.lastSyncAt': new Date()
    });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    if (error instanceof ExpressError) {
      throw error;
    }
    throw new ExpressError('Failed to update calendar event', 500);
  }
};

/**
 * Delete a calendar event for a reservation
 * @param userId - User ID (studio owner)
 * @param eventId - Calendar event ID
 */
export const deleteCalendarEvent = async (
  userId: string,
  eventId: string
): Promise<void> => {
  try {
    // Get user with Google Calendar tokens
    const user = await UserModel.findById(userId).select('googleCalendar');
    
    if (!user || !user.googleCalendar?.connected) {
      // If calendar not connected, just return (event might not exist)
      return;
    }

    // Get and refresh token if needed
    const accessToken = await getAndRefreshToken(userId, user);

    // Create calendar client
    const calendar = google.calendar({ version: 'v3', auth: getAuthenticatedClient(accessToken) });

    // Delete event
    const calendarId = user.googleCalendar.calendarId || 'primary';
    await calendar.events.delete({
      calendarId: calendarId,
      eventId: eventId
    });

    // Update last sync time
    await UserModel.findByIdAndUpdate(userId, {
      'googleCalendar.lastSyncAt': new Date()
    });
  } catch (error) {
    // If event not found (404), that's okay - it might have been deleted already
    if (error instanceof Error && 'code' in error && error.code === 404) {
      console.log('Calendar event not found, may have been deleted already');
      return;
    }
    console.error('Error deleting calendar event:', error);
    // Don't throw error - deletion is best effort
  }
};

/**
 * Sync a reservation to Google Calendar
 * Creates, updates, or deletes calendar event based on reservation status
 * @param reservation - Reservation object
 */
export const syncReservationToCalendar = async (reservation: Reservation): Promise<void> => {
  try {
    // Get studio to find the owner
    const studio = await StudioModel.findById(reservation.studioId);
    if (!studio) {
      console.error('Studio not found for reservation:', reservation._id);
      return;
    }

    // Get studio owner
    const owner = await UserModel.findById(studio.createdBy).select('googleCalendar');
    
    if (!owner || !owner.googleCalendar?.connected) {
      // Calendar not connected, skip sync
      return;
    }

    const { RESERVATION_STATUS } = await import('../services/reservationService.js');

    // Handle based on reservation status
    if (reservation.status === RESERVATION_STATUS.CONFIRMED) {
      // Create or update event
      if (reservation.googleCalendarEventId) {
        // Update existing event
        await updateCalendarEvent(owner._id.toString(), reservation.googleCalendarEventId, reservation);
      } else {
        // Create new event
        const eventId = await createCalendarEvent(owner._id.toString(), reservation);
        
        // Save event ID to reservation
        await ReservationModel.findByIdAndUpdate(reservation._id, {
          googleCalendarEventId: eventId
        });
      }
    } else if (
      reservation.status === RESERVATION_STATUS.CANCELLED ||
      reservation.status === RESERVATION_STATUS.REJECTED ||
      reservation.status === RESERVATION_STATUS.EXPIRED
    ) {
      // Delete event if it exists
      if (reservation.googleCalendarEventId) {
        await deleteCalendarEvent(owner._id.toString(), reservation.googleCalendarEventId);
        
        // Remove event ID from reservation
        await ReservationModel.findByIdAndUpdate(reservation._id, {
          $unset: { googleCalendarEventId: '' }
        });
      }
    }
  } catch (error) {
    console.error('Error syncing reservation to calendar:', error);
    // Don't throw - calendar sync should not break reservation flow
  }
};

