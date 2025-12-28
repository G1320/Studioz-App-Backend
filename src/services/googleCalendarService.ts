import { google, calendar_v3 } from 'googleapis';
import { UserModel } from '../models/userModel.js';
import { StudioModel } from '../models/studioModel.js';
import { ItemModel } from '../models/itemModel.js';
import { ReservationModel } from '../models/reservationModel.js';
import { getValidAccessToken, getAuthenticatedClient, isTokenExpired, refreshAccessToken } from '../utils/googleOAuthUtils.js';
import { formatReservationToCalendarEvent, parseCalendarEventToTimeSlots, shouldBlockTimeSlotsForEvent } from '../utils/googleCalendarUtils.js';
import { initializeAvailability, findOrCreateDateAvailability, removeTimeSlots, generateTimeSlots } from '../utils/timeSlotUtils.js';
import { emitAvailabilityUpdate } from '../webSockets/socket.js';
import ExpressError from '../utils/expressError.js';
import Reservation from '../types/reservation.js';
import { GOOGLE_CALENDAR_WEBHOOK_URL } from '../config/index.js';
import crypto from 'crypto';

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
 * Set up a watch channel for Google Calendar push notifications
 * @param userId - User ID
 * @returns Watch channel info
 */
export const setupWatchChannel = async (userId: string): Promise<void> => {
  try {
    const user = await UserModel.findById(userId).select('googleCalendar');
    if (!user || !user.googleCalendar?.connected) {
      throw new ExpressError('Google Calendar not connected', 400);
    }

    // Stop existing watch channel if any
    if (user.googleCalendar.watchChannelId && user.googleCalendar.watchResourceId) {
      try {
        await stopWatchChannel(userId);
      } catch (error) {
        console.warn('[Watch Channel] Error stopping existing channel:', error);
        // Continue to create new channel
      }
    }

    // Get and refresh token if needed
    const accessToken = await getAndRefreshToken(userId, user);
    const calendar = google.calendar({ version: 'v3', auth: getAuthenticatedClient(accessToken) });
    const calendarId = user.googleCalendar.calendarId || 'primary';

    // Generate unique channel ID
    const channelId = `channel-${userId}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const resourceId = `resource-${userId}-${Date.now()}`;

    // Calculate expiration (7 days from now, but set to 6 days to be safe)
    const expiration = new Date();
    expiration.setTime(expiration.getTime() + 6 * 24 * 60 * 60 * 1000); // 6 days

    // Create watch channel
    const watchRequest: calendar_v3.Params$Resource$Events$Watch = {
      calendarId: calendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: GOOGLE_CALENDAR_WEBHOOK_URL,
        token: userId, // Include userId in token for webhook verification
        expiration: expiration.getTime().toString()
      }
    };

    console.log(`[Watch Channel] Setting up watch channel for user ${userId}`);
    const response = await calendar.events.watch(watchRequest);

    if (!response.data.id || !response.data.resourceId) {
      throw new ExpressError('Failed to create watch channel', 500);
    }

    // Store channel info in user model
    await UserModel.findByIdAndUpdate(userId, {
      'googleCalendar.watchChannelId': response.data.id,
      'googleCalendar.watchResourceId': response.data.resourceId,
      'googleCalendar.watchExpiration': new Date(response.data.expiration || expiration.getTime())
    });

    console.log(`[Watch Channel] Watch channel created successfully for user ${userId}, expires: ${new Date(response.data.expiration || expiration.getTime())}`);
  } catch (error) {
    console.error('[Watch Channel] Error setting up watch channel:', error);
    if (error instanceof ExpressError) {
      throw error;
    }
    throw new ExpressError('Failed to set up watch channel', 500);
  }
};

/**
 * Stop a watch channel
 * @param userId - User ID
 */
export const stopWatchChannel = async (userId: string): Promise<void> => {
  try {
    const user = await UserModel.findById(userId).select('googleCalendar');
    if (!user || !user.googleCalendar?.watchChannelId || !user.googleCalendar?.watchResourceId) {
      return; // No channel to stop
    }

    const accessToken = await getAndRefreshToken(userId, user);
    const calendar = google.calendar({ version: 'v3', auth: getAuthenticatedClient(accessToken) });

    // Stop the watch channel
    await calendar.channels.stop({
      requestBody: {
        id: user.googleCalendar.watchChannelId,
        resourceId: user.googleCalendar.watchResourceId
      }
    });

    // Clear channel info from user model
    await UserModel.findByIdAndUpdate(userId, {
      $unset: {
        'googleCalendar.watchChannelId': '',
        'googleCalendar.watchResourceId': '',
        'googleCalendar.watchExpiration': ''
      }
    });

    console.log(`[Watch Channel] Watch channel stopped for user ${userId}`);
  } catch (error) {
    console.error('[Watch Channel] Error stopping watch channel:', error);
    // Don't throw - best effort to clean up
  }
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

    // Set up watch channel for push notifications
    try {
      console.log(`[Calendar Connect] Setting up watch channel for user ${userId}`);
      await setupWatchChannel(userId);
      console.log('[Calendar Connect] Watch channel set up successfully');
    } catch (error) {
      console.error('[Calendar Connect] Error setting up watch channel:', error);
      // Don't fail the connection if watch setup fails - we can still use manual sync
    }

    // Trigger initial sync to block time slots from existing calendar events
    try {
      console.log(`[Calendar Connect] Triggering initial sync for user ${userId}`);
      await syncCalendarEventsToTimeSlots(userId);
      console.log('[Calendar Connect] Initial calendar sync completed');
    } catch (error) {
      console.error('[Calendar Connect] Error during initial calendar sync:', error);
      if (error instanceof Error) {
        console.error('[Calendar Connect] Error details:', error.message, error.stack);
      }
      // Don't fail the connection if sync fails
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
    // Stop watch channel before disconnecting
    try {
      await stopWatchChannel(userId);
    } catch (error) {
      console.warn('[Calendar Disconnect] Error stopping watch channel:', error);
      // Continue with disconnect
    }

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

/**
 * Block time slots for all items in a user's studios based on a calendar event
 * @param userId - User ID (studio owner)
 * @param event - Google Calendar event
 */
export const blockTimeSlotsFromCalendarEvent = async (
  userId: string,
  event: calendar_v3.Schema$Event
): Promise<void> => {
  try {
    // Check if we should block time slots for this event
    if (!shouldBlockTimeSlotsForEvent(event)) {
      console.log('Skipping time slot blocking for app-created event:', event.id);
      return;
    }

    // Parse event to get booking date and time slots
    if (!event.start?.dateTime || !event.end?.dateTime) {
      console.log('Event missing start or end time:', event.id);
      return;
    }

    const { bookingDate, timeSlots } = parseCalendarEventToTimeSlots(
      event.start.dateTime,
      event.end.dateTime
    );

    // Find all studios owned by this user
    const studios = await StudioModel.find({ createdBy: userId });
    if (!studios || studios.length === 0) {
      console.log('No studios found for user:', userId);
      return;
    }

    // Get all items from all studios
    const studioIds = studios.map(studio => studio._id);
    const items = await ItemModel.find({ studioId: { $in: studioIds } });
    
    if (!items || items.length === 0) {
      console.log('No items found for user studios:', userId);
      return;
    }

    const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    // Block time slots for all items
    for (const item of items) {
      item.availability = initializeAvailability(item.availability);
      const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, defaultHours);
      
      // Remove time slots that overlap with the calendar event
      dateAvailability.times = removeTimeSlots(dateAvailability.times, timeSlots);
      
      item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
      );
      
      await item.save();
      emitAvailabilityUpdate(item._id);
    }

    console.log(`Blocked time slots for ${items.length} items from calendar event:`, event.id);
  } catch (error) {
    console.error('Error blocking time slots from calendar event:', error);
    // Don't throw - calendar event processing should not break the system
  }
};

/**
 * Unblock time slots for all items in a user's studios when a calendar event is deleted
 * @param userId - User ID (studio owner)
 * @param eventStart - Event start datetime
 * @param eventEnd - Event end datetime
 */
export const unblockTimeSlotsFromCalendarEvent = async (
  userId: string,
  eventStart: string | Date,
  eventEnd: string | Date
): Promise<void> => {
  try {
    // Parse event to get booking date and time slots
    const { bookingDate, timeSlots } = parseCalendarEventToTimeSlots(eventStart, eventEnd);

    // Find all studios owned by this user
    const studios = await StudioModel.find({ createdBy: userId });
    if (!studios || studios.length === 0) {
      return;
    }

    // Get all items from all studios
    const studioIds = studios.map(studio => studio._id);
    const items = await ItemModel.find({ studioId: { $in: studioIds } });
    
    if (!items || items.length === 0) {
      return;
    }

    const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    const { addTimeSlots } = await import('../utils/timeSlotUtils.js');

    // Unblock time slots for all items
    for (const item of items) {
      item.availability = initializeAvailability(item.availability);
      const dateAvailability = findOrCreateDateAvailability(item.availability, bookingDate, defaultHours);
      
      // Add time slots back
      dateAvailability.times = addTimeSlots(dateAvailability.times, timeSlots);
      
      item.availability = item.availability.map(avail =>
        avail.date === bookingDate ? dateAvailability : avail
      );
      
      await item.save();
      emitAvailabilityUpdate(item._id);
    }

    console.log(`Unblocked time slots for ${items.length} items from deleted calendar event`);
  } catch (error) {
    console.error('Error unblocking time slots from calendar event:', error);
    // Don't throw - calendar event processing should not break the system
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
    console.log(`[Calendar Sync] Starting sync for user ${userId}, syncToken: ${syncToken ? 'present' : 'none'}`);
    
    const user = await UserModel.findById(userId).select('googleCalendar');
    if (!user || !user.googleCalendar?.connected) {
      console.log(`[Calendar Sync] Google Calendar not connected for user: ${userId}`);
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

    console.log(`[Calendar Sync] Fetching events from calendar ${calendarId}...`);
    const response = await calendar.events.list(params);
    const events = response.data.items || [];
    const nextSyncToken = response.data.nextSyncToken;

    console.log(`[Calendar Sync] Found ${events.length} events to process`);

    let blockedCount = 0;
    let unblockedCount = 0;
    let skippedCount = 0;

    // Process each event
    for (const event of events) {
      if (!event.start || !event.end) {
        skippedCount++;
        continue;
      }

      // Skip all-day events (they have 'date' instead of 'dateTime')
      if (event.start.date || event.end.date) {
        skippedCount++;
        console.log(`[Calendar Sync] Skipping all-day event: ${event.summary || event.id}`);
        continue;
      }

      // Check event status
      if (event.status === 'cancelled') {
        // Event was deleted, unblock time slots
        if (event.start.dateTime && event.end.dateTime) {
          console.log(`[Calendar Sync] Unblocking time slots for cancelled event: ${event.summary || event.id}`);
          await unblockTimeSlotsFromCalendarEvent(userId, event.start.dateTime, event.end.dateTime);
          unblockedCount++;
        }
      } else if (event.status === 'confirmed') {
        // Event exists or was created/updated, block time slots
        console.log(`[Calendar Sync] Blocking time slots for event: ${event.summary || event.id}, start: ${event.start.dateTime}, end: ${event.end.dateTime}`);
        await blockTimeSlotsFromCalendarEvent(userId, event);
        blockedCount++;
      } else {
        skippedCount++;
        console.log(`[Calendar Sync] Skipping event with status '${event.status}': ${event.summary || event.id}`);
      }
    }

    console.log(`[Calendar Sync] Summary - Blocked: ${blockedCount}, Unblocked: ${unblockedCount}, Skipped: ${skippedCount}`);

    // Update sync token in user model
    if (nextSyncToken) {
      await UserModel.findByIdAndUpdate(userId, {
        'googleCalendar.lastSyncAt': new Date(),
        'googleCalendar.syncToken': nextSyncToken
      });
      console.log(`[Calendar Sync] Updated sync token for user ${userId}`);
    }

    return nextSyncToken || undefined;
  } catch (error) {
    console.error('[Calendar Sync] Error syncing calendar events to time slots:', error);
    if (error instanceof Error) {
      console.error('[Calendar Sync] Error details:', error.message, error.stack);
    }
    // Don't throw - calendar sync should not break the system
    return undefined;
  }
};

/**
 * Check and renew expired watch channels
 * Watch channels expire after 7 days, so we need to renew them
 */
export const renewExpiredChannels = async (): Promise<void> => {
  try {
    const users = await UserModel.find({
      'googleCalendar.connected': true,
      'googleCalendar.watchExpiration': { $exists: true, $lt: new Date() }
    }).select('_id googleCalendar');

    console.log(`[Watch Channel] Found ${users.length} users with expired channels`);

    for (const user of users) {
      try {
        console.log(`[Watch Channel] Renewing expired channel for user ${user._id}`);
        await setupWatchChannel(user._id.toString());
      } catch (error) {
        console.error(`[Watch Channel] Error renewing channel for user ${user._id}:`, error);
        // Continue with other users
      }
    }
  } catch (error) {
    console.error('[Watch Channel] Error checking expired channels:', error);
  }
};

/**
 * Check if a user's watch channel is expired or about to expire
 * @param userId - User ID
 * @returns true if channel needs renewal
 */
export const isChannelExpired = async (userId: string): Promise<boolean> => {
  try {
    const user = await UserModel.findById(userId).select('googleCalendar');
    if (!user || !user.googleCalendar?.watchExpiration) {
      return true; // No channel, consider it expired
    }

    // Renew if expired or expires within 1 day
    const expiration = new Date(user.googleCalendar.watchExpiration);
    const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return expiration <= oneDayFromNow;
  } catch (error) {
    console.error(`[Watch Channel] Error checking channel expiration for user ${userId}:`, error);
    return true; // On error, assume expired
  }
};

