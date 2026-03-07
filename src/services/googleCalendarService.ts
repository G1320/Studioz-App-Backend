import { google, calendar_v3 } from 'googleapis';
import { randomUUID } from 'crypto';
import { UserModel } from '../models/userModel.js';
import { StudioModel } from '../models/studioModel.js';
import { ItemModel } from '../models/itemModel.js';
import { ReservationModel } from '../models/reservationModel.js';
import { getValidAccessToken, getAuthenticatedClient, isTokenExpired, refreshAccessToken, GoogleTokenError } from '../utils/googleOAuthUtils.js';
import { formatReservationToCalendarEvent, parseCalendarEventToTimeSlots, shouldBlockTimeSlotsForEvent } from '../utils/googleCalendarUtils.js';
import { initializeAvailability, findOrCreateDateAvailability, removeTimeSlots, generateTimeSlots } from '../utils/timeSlotUtils.js';
import { emitAvailabilityUpdate, emitBulkAvailabilityUpdate } from '../webSockets/socket.js';
import { GOOGLE_CALENDAR_CONFIG } from '../config/googleCalendarConfig.js';
import ExpressError from '../utils/expressError.js';
import Reservation from '../types/reservation.js';

/**
 * Helper function to get and refresh access token if needed
 * Updates user in database if token was refreshed
 * 
 * @throws GoogleTokenError if token refresh fails (caller should handle appropriately)
 * @throws ExpressError if no tokens are available
 */
const getAndRefreshToken = async (userId: string, user: any): Promise<string> => {
  // Check for missing access token
  if (!user.googleCalendar?.accessToken) {
    throw new ExpressError('Google Calendar access token not found', 400);
  }
  
  let accessToken = user.googleCalendar.accessToken;
  
  // Check if token needs refresh
  if (isTokenExpired(user.googleCalendar.tokenExpiry)) {
    if (!user.googleCalendar.refreshToken) {
      // No refresh token - connection is invalid, clear it
      console.log('[GoogleCalendar] Token expired and no refresh token, clearing connection:', userId);
      await clearGoogleCalendarConnection(userId);
      throw new ExpressError('Google Calendar session expired. Please reconnect your calendar.', 400);
    }
    
    try {
      const { accessToken: newToken, expiryDate } = await refreshAccessToken(
        user.googleCalendar.refreshToken
      );
      await UserModel.findByIdAndUpdate(userId, {
        'googleCalendar.accessToken': newToken,
        'googleCalendar.tokenExpiry': expiryDate
      });
      accessToken = newToken;
      console.log('[GoogleCalendar] Token refreshed successfully for user:', userId);
    } catch (error) {
      // Token refresh failed - clear connection and throw user-friendly error
      console.log('[GoogleCalendar] Token refresh failed during operation:', userId, error);
      await clearGoogleCalendarConnection(userId);
      throw new ExpressError('Google Calendar connection expired. Please reconnect your calendar.', 400);
    }
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

    // Trigger initial sync to block time slots from existing calendar events
    try {
      await syncCalendarEventsToTimeSlots(userId);
      console.log('Initial calendar sync completed');
    } catch (error) {
      console.error('Error during initial calendar sync:', error);
      // Don't fail the connection if sync fails
    }

    // Set up push notifications for real-time sync
    try {
      await startWatchingCalendar(userId);
    } catch (error) {
      console.error('Error setting up calendar watch:', error);
      // Don't fail the connection if watch fails - polling will still work
    }

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
    // Stop push notifications before disconnecting
    await stopWatchingCalendar(userId);

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
 * Clear Google Calendar connection for a user
 * Used when tokens are invalid/revoked to allow reconnection
 * @param userId - User ID
 */
const clearGoogleCalendarConnection = async (userId: string): Promise<void> => {
  // Clear watch channel fields along with the rest (no API call since tokens are invalid)
  await UserModel.findByIdAndUpdate(userId, {
    $unset: { 'googleCalendar': '' }
  });
};

/**
 * Get user's Google Calendar connection status
 * Validates tokens and clears connection if tokens are invalid
 * 
 * IMPORTANT: This function ALWAYS returns a 200-style response with connection state.
 * It NEVER throws errors - all errors are caught and result in { connected: false }.
 * This ensures the frontend can always display the correct UI state.
 * 
 * @param userId - User ID
 * @returns Connection status - always returns { connected: boolean, lastSyncAt?: Date }
 */
export const getConnectionStatus = async (userId: string): Promise<{
  connected: boolean;
  lastSyncAt?: Date;
}> => {
  try {
    // Validate userId
    if (!userId) {
      console.log('[GoogleCalendar] No userId provided for status check');
      return { connected: false };
    }

    // Include protected token fields for validation
    const user = await UserModel.findById(userId).select('+googleCalendar.accessToken +googleCalendar.refreshToken googleCalendar');

    // User not found or calendar never connected
    if (!user) {
      console.log('[GoogleCalendar] User not found:', userId);
      return { connected: false };
    }

    if (!user.googleCalendar?.connected) {
      return { connected: false };
    }

    // Check for missing tokens (corrupted state)
    if (!user.googleCalendar.accessToken && !user.googleCalendar.refreshToken) {
      console.log('[GoogleCalendar] User marked as connected but no tokens found, clearing:', userId);
      await clearGoogleCalendarConnection(userId);
      return { connected: false };
    }

    // Verify token is still valid by attempting refresh if expired
    if (isTokenExpired(user.googleCalendar.tokenExpiry)) {
      if (!user.googleCalendar.refreshToken) {
        // No refresh token - clear connection so user can reconnect
        console.log('[GoogleCalendar] No refresh token available, clearing connection for user:', userId);
        await clearGoogleCalendarConnection(userId);
        return { connected: false };
      }

      try {
        const { accessToken, expiryDate } = await refreshAccessToken(user.googleCalendar.refreshToken);
        // Update tokens in database
        await UserModel.findByIdAndUpdate(userId, {
          'googleCalendar.accessToken': accessToken,
          'googleCalendar.tokenExpiry': expiryDate
        });
        console.log('[GoogleCalendar] Successfully refreshed token for user:', userId);
      } catch (error) {
        // Handle token refresh failure
        if (error instanceof GoogleTokenError) {
          if (error.isRevoked) {
            console.log('[GoogleCalendar] Refresh token revoked, clearing connection for user:', userId);
          } else {
            console.log('[GoogleCalendar] Token refresh failed (non-revocation), clearing connection for user:', userId);
          }
        } else {
          console.log('[GoogleCalendar] Unexpected error refreshing token, clearing connection for user:', userId, error);
        }
        
        // Clear connection so user can reconnect with fresh OAuth flow
        await clearGoogleCalendarConnection(userId);
        return { connected: false };
      }
    }

    return {
      connected: true,
      lastSyncAt: user.googleCalendar.lastSyncAt || undefined
    };
  } catch (error) {
    // Catch-all for any unexpected errors - NEVER throw from this function
    console.error('[GoogleCalendar] Unexpected error in getConnectionStatus:', error);
    
    // Attempt to clear connection if possible (fire and forget)
    try {
      if (userId) {
        await clearGoogleCalendarConnection(userId);
      }
    } catch (clearError) {
      console.error('[GoogleCalendar] Failed to clear connection after error:', clearError);
    }
    
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

/**
 * Block time slots for all items in a user's studios based on a calendar event
 * @param userId - User ID (studio owner)
 * @param event - Google Calendar event
 * @param skipEmit - If true, don't emit socket events (for batch operations)
 * @returns Array of affected item IDs (for batch emit)
 */
export const blockTimeSlotsFromCalendarEvent = async (
  userId: string,
  event: calendar_v3.Schema$Event,
  skipEmit: boolean = false
): Promise<string[]> => {
  const affectedItemIds: string[] = [];
  
  try {
    // Check if we should block time slots for this event
    if (!shouldBlockTimeSlotsForEvent(event)) {
      console.log('Skipping time slot blocking for app-created event:', event.id);
      return affectedItemIds;
    }

    // Parse event to get booking date and time slots
    if (!event.start?.dateTime || !event.end?.dateTime) {
      console.log('Event missing start or end time:', event.id);
      return affectedItemIds;
    }

    const { bookingDate, timeSlots } = parseCalendarEventToTimeSlots(
      event.start.dateTime,
      event.end.dateTime
    );

    // Find all studios owned by this user
    const studios = await StudioModel.find({ createdBy: userId });
    if (!studios || studios.length === 0) {
      console.log('No studios found for user:', userId);
      return affectedItemIds;
    }

    // Get all items from all studios
    const studioIds = studios.map(studio => studio._id);
    const items = await ItemModel.find({ studioId: { $in: studioIds } });
    
    if (!items || items.length === 0) {
      console.log('No items found for user studios:', userId);
      return affectedItemIds;
    }

    const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    // Block time slots for all items - prepare updates first
    for (const item of items) {
      item.availability = initializeAvailability(item.availability);
      const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, defaultHours);

      // Remove time slots that overlap with the calendar event
      dateAvailability.times = removeTimeSlots(dateAvailability.times, timeSlots);

      item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
      );

      affectedItemIds.push(item._id.toString());
    }

    // Save all items in parallel (fixes N+1 query pattern)
    await Promise.all(items.map(item => item.save()));

    // Emit updates after all saves complete
    if (!skipEmit) {
      affectedItemIds.forEach(itemId => emitAvailabilityUpdate(itemId));
    }

    console.log(`Blocked time slots for ${items.length} items from calendar event:`, event.id);
    return affectedItemIds;
  } catch (error) {
    console.error('Error blocking time slots from calendar event:', error);
    // Don't throw - calendar event processing should not break the system
    return affectedItemIds;
  }
};

/**
 * Unblock time slots for all items in a user's studios when a calendar event is deleted
 * @param userId - User ID (studio owner)
 * @param eventStart - Event start datetime
 * @param eventEnd - Event end datetime
 * @param skipEmit - If true, don't emit socket events (for batch operations)
 * @returns Array of affected item IDs (for batch emit)
 */
export const unblockTimeSlotsFromCalendarEvent = async (
  userId: string,
  eventStart: string | Date,
  eventEnd: string | Date,
  skipEmit: boolean = false
): Promise<string[]> => {
  const affectedItemIds: string[] = [];
  
  try {
    // Parse event to get booking date and time slots
    const { bookingDate, timeSlots } = parseCalendarEventToTimeSlots(eventStart, eventEnd);

    // Find all studios owned by this user
    const studios = await StudioModel.find({ createdBy: userId });
    if (!studios || studios.length === 0) {
      return affectedItemIds;
    }

    // Get all items from all studios
    const studioIds = studios.map(studio => studio._id);
    const items = await ItemModel.find({ studioId: { $in: studioIds } });
    
    if (!items || items.length === 0) {
      return affectedItemIds;
    }

    const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    const { addTimeSlots } = await import('../utils/timeSlotUtils.js');

    // Unblock time slots for all items - prepare updates first
    for (const item of items) {
      item.availability = initializeAvailability(item.availability);
      const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, defaultHours);

      // Add time slots back
      dateAvailability.times = addTimeSlots(dateAvailability.times, timeSlots);

      item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
      );

      affectedItemIds.push(item._id.toString());
    }

    // Save all items in parallel (fixes N+1 query pattern)
    await Promise.all(items.map(item => item.save()));

    // Emit updates after all saves complete
    if (!skipEmit) {
      affectedItemIds.forEach(itemId => emitAvailabilityUpdate(itemId));
    }

    console.log(`Unblocked time slots for ${items.length} items from deleted calendar event`);
    return affectedItemIds;
  } catch (error) {
    console.error('Error unblocking time slots from calendar event:', error);
    // Don't throw - calendar event processing should not break the system
    return affectedItemIds;
  }
};

/**
 * Process calendar events and update time slots
 * Fetches changed events from Google Calendar and processes them
 * @param userId - User ID (studio owner)
 * @param syncToken - Optional sync token for incremental sync
 */
export const syncCalendarEventsToTimeSlots = async (
  userId: string,
  syncToken?: string
): Promise<string | undefined> => {
  try {
    const user = await UserModel.findById(userId).select('googleCalendar');
    if (!user || !user.googleCalendar?.connected) {
      console.log('Google Calendar not connected for user:', userId);
      return;
    }

    // Get and refresh token if needed
    const accessToken = await getAndRefreshToken(userId, user);
    const calendar = google.calendar({ version: 'v3', auth: getAuthenticatedClient(accessToken) });
    const calendarId = user.googleCalendar.calendarId || 'primary';

    // Fetch events
    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId: calendarId,
      timeMin: new Date().toISOString(), // Only future events
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100
    };

    if (syncToken) {
      params.syncToken = syncToken;
    }

    const response = await calendar.events.list(params);
    const events = response.data.items || [];
    const nextSyncToken = response.data.nextSyncToken;

    // Collect all affected item IDs to emit once at the end
    const allAffectedItemIds: Set<string> = new Set();

    // Process each event in batch mode (skipEmit = true)
    for (const event of events) {
      if (!event.start || !event.end) continue;

      // Skip all-day events (they have 'date' instead of 'dateTime')
      if (event.start.date || event.end.date) {
        continue;
      }

      // Check event status
      if (event.status === 'cancelled') {
        // Event was deleted, unblock time slots
        if (event.start.dateTime && event.end.dateTime) {
          const itemIds = await unblockTimeSlotsFromCalendarEvent(
            userId, 
            event.start.dateTime, 
            event.end.dateTime,
            true // skipEmit - we'll emit once at the end
          );
          itemIds.forEach(id => allAffectedItemIds.add(id));
        }
      } else if (event.status === 'confirmed') {
        // Event exists or was created/updated, block time slots
        const itemIds = await blockTimeSlotsFromCalendarEvent(
          userId, 
          event,
          true // skipEmit - we'll emit once at the end
        );
        itemIds.forEach(id => allAffectedItemIds.add(id));
      }
    }

    // Emit a single bulk update for all affected items
    if (allAffectedItemIds.size > 0) {
      emitBulkAvailabilityUpdate(Array.from(allAffectedItemIds));
      console.log(`Emitted bulk availability update for ${allAffectedItemIds.size} items`);
    }

    // Update sync token in user model
    if (nextSyncToken) {
      await UserModel.findByIdAndUpdate(userId, {
        'googleCalendar.lastSyncAt': new Date(),
        'googleCalendar.syncToken': nextSyncToken
      });
    }

    return nextSyncToken || undefined;
  } catch (error) {
    console.error('Error syncing calendar events to time slots:', error);
    // Don't throw - calendar sync should not break the system
    return undefined;
  }
};

/**
 * Result of syncing all connected calendars
 */
export interface SyncAllResult {
  synced: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
}

/**
 * Start watching a user's Google Calendar for push notifications
 * Creates a watch channel so Google sends real-time notifications when events change
 * @param userId - User ID
 */
export const startWatchingCalendar = async (userId: string): Promise<void> => {
  try {
    if (!GOOGLE_CALENDAR_CONFIG.webhookUrl) {
      console.log('[GoogleCalendar] No webhook URL configured, skipping watch setup for user:', userId);
      return;
    }

    const user = await UserModel.findById(userId).select('+googleCalendar.accessToken +googleCalendar.refreshToken googleCalendar');
    if (!user || !user.googleCalendar?.connected) {
      return;
    }

    const accessToken = await getAndRefreshToken(userId, user);
    const calendar = google.calendar({ version: 'v3', auth: getAuthenticatedClient(accessToken) });
    const calendarId = user.googleCalendar.calendarId || 'primary';

    const channelId = randomUUID();
    // Watch channels expire after ~7 days max; request slightly less to allow renewal
    const expiration = Date.now() + 6 * 24 * 60 * 60 * 1000; // 6 days

    const response = await calendar.events.watch({
      calendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: GOOGLE_CALENDAR_CONFIG.webhookUrl,
        token: userId, // Used to identify the user when webhook fires
        expiration: String(expiration)
      }
    });

    // Save watch channel info
    await UserModel.findByIdAndUpdate(userId, {
      'googleCalendar.watchChannelId': channelId,
      'googleCalendar.watchResourceId': response.data.resourceId,
      'googleCalendar.watchExpiration': new Date(Number(response.data.expiration))
    });

    console.log('[GoogleCalendar] Watch channel created for user:', userId, 'channelId:', channelId);
  } catch (error) {
    console.error('[GoogleCalendar] Error starting watch for user:', userId, error);
    // Don't throw - watch setup failure shouldn't break the flow
  }
};

/**
 * Stop watching a user's Google Calendar
 * Stops the push notification channel
 * @param userId - User ID
 */
export const stopWatchingCalendar = async (userId: string): Promise<void> => {
  try {
    const user = await UserModel.findById(userId).select('+googleCalendar.accessToken +googleCalendar.refreshToken googleCalendar');
    if (!user?.googleCalendar?.watchChannelId || !user.googleCalendar.watchResourceId) {
      return;
    }

    const accessToken = await getAndRefreshToken(userId, user);
    const calendar = google.calendar({ version: 'v3', auth: getAuthenticatedClient(accessToken) });

    await calendar.channels.stop({
      requestBody: {
        id: user.googleCalendar.watchChannelId,
        resourceId: user.googleCalendar.watchResourceId
      }
    });

    console.log('[GoogleCalendar] Watch channel stopped for user:', userId);
  } catch (error) {
    // Channel may already be expired/stopped - that's fine
    console.log('[GoogleCalendar] Error stopping watch (may already be expired):', userId, error instanceof Error ? error.message : error);
  } finally {
    // Always clear the watch fields
    await UserModel.findByIdAndUpdate(userId, {
      $unset: {
        'googleCalendar.watchChannelId': '',
        'googleCalendar.watchResourceId': '',
        'googleCalendar.watchExpiration': ''
      }
    });
  }
};

/**
 * Process an incoming Google Calendar webhook notification
 * Triggered when events change on a watched calendar
 * @param channelId - The watch channel ID (from X-Goog-Channel-ID header)
 * @param resourceId - The resource ID (from X-Goog-Resource-ID header)
 */
export const processWebhookNotification = async (channelId: string, resourceId: string): Promise<void> => {
  try {
    // Find the user by watch channel info
    const user = await UserModel.findOne({
      'googleCalendar.watchChannelId': channelId,
      'googleCalendar.watchResourceId': resourceId,
      'googleCalendar.connected': true
    }).select('+googleCalendar.accessToken +googleCalendar.refreshToken googleCalendar');

    if (!user) {
      console.log('[GoogleCalendar] No user found for webhook channelId:', channelId);
      return;
    }

    const userId = user._id.toString();
    console.log('[GoogleCalendar] Processing webhook notification for user:', userId);

    // Use the existing sync function with the stored sync token
    await syncCalendarEventsToTimeSlots(userId, user.googleCalendar?.syncToken || undefined);
    console.log('[GoogleCalendar] Webhook sync completed for user:', userId);
  } catch (error) {
    console.error('[GoogleCalendar] Error processing webhook notification:', error);
  }
};

/**
 * Renew watch channels that are about to expire
 * Should be called periodically (e.g., daily) to keep channels alive
 */
export const renewExpiringWatchChannels = async (): Promise<{ renewed: number; failed: number }> => {
  const results = { renewed: 0, failed: 0 };

  try {
    // Find users with watch channels expiring within 24 hours
    const expirationThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const users = await UserModel.find({
      'googleCalendar.connected': true,
      'googleCalendar.watchChannelId': { $exists: true, $ne: null },
      'googleCalendar.watchExpiration': { $lt: expirationThreshold }
    }).select('_id');

    if (users.length === 0) {
      return results;
    }

    console.log(`[GoogleCalendar] Renewing ${users.length} expiring watch channels`);

    for (const user of users) {
      try {
        await stopWatchingCalendar(user._id.toString());
        await startWatchingCalendar(user._id.toString());
        results.renewed++;
      } catch (error) {
        results.failed++;
        console.error('[GoogleCalendar] Failed to renew watch for user:', user._id, error);
      }
    }

    return results;
  } catch (error) {
    console.error('[GoogleCalendar] Error renewing watch channels:', error);
    return results;
  }
};

/**
 * Set up watch channels for all connected users that don't have one
 * Useful for initial setup or recovery after server restart
 */
export const setupMissingWatchChannels = async (): Promise<{ setup: number; failed: number }> => {
  const results = { setup: 0, failed: 0 };

  try {
    if (!GOOGLE_CALENDAR_CONFIG.webhookUrl) {
      return results;
    }

    const users = await UserModel.find({
      'googleCalendar.connected': true,
      $or: [
        { 'googleCalendar.watchChannelId': { $exists: false } },
        { 'googleCalendar.watchChannelId': null }
      ]
    }).select('_id');

    if (users.length === 0) {
      return results;
    }

    console.log(`[GoogleCalendar] Setting up watch channels for ${users.length} users`);

    for (const user of users) {
      try {
        await startWatchingCalendar(user._id.toString());
        results.setup++;
      } catch (error) {
        results.failed++;
        console.error('[GoogleCalendar] Failed to setup watch for user:', user._id, error);
      }
    }

    return results;
  } catch (error) {
    console.error('[GoogleCalendar] Error setting up watch channels:', error);
    return results;
  }
};

/**
 * Sync calendar events for all users with connected Google Calendars
 * Processes users in batches to avoid rate limits
 * @returns Sync results summary
 */
export const syncAllConnectedCalendars = async (): Promise<SyncAllResult> => {
  const results: SyncAllResult = { synced: 0, failed: 0, errors: [] };
  const BATCH_SIZE = 5;

  try {
    // Find all users with connected Google Calendar
    const users = await UserModel.find({
      'googleCalendar.connected': true
    }).select('_id googleCalendar.syncToken');

    if (users.length === 0) {
      console.log('[GoogleCalendarSync] No users with connected calendars');
      return results;
    }

    console.log(`[GoogleCalendarSync] Processing ${users.length} users`);

    // Process users in batches to avoid rate limits
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (user) => {
        try {
          await syncCalendarEventsToTimeSlots(
            user._id.toString(),
            user.googleCalendar?.syncToken || undefined
          );
          results.synced++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            userId: user._id.toString(),
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.error(`[GoogleCalendarSync] Failed for user ${user._id}:`, error);
        }
      }));
    }

    return results;
  } catch (error) {
    console.error('[GoogleCalendarSync] Error fetching users:', error);
    return results;
  }
};

