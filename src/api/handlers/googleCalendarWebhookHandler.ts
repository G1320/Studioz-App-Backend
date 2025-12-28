import { Request, Response } from 'express';
import { UserModel } from '../../models/userModel.js';
import { syncCalendarEventsToTimeSlots, isChannelExpired, setupWatchChannel } from '../../services/googleCalendarService.js';

/**
 * Handle Google Calendar webhook notifications
 * POST /api/webhooks/google-calendar
 * 
 * Google Calendar sends notifications when events change.
 * We need to:
 * 1. Verify the notification (check headers)
 * 2. Extract the user ID from the token
 * 3. Sync calendar events to update time slots
 */
export const handleGoogleCalendarWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const headers = req.headers;
    const body = req.body;

    console.log('[Calendar Webhook] Received notification:', {
      'x-goog-channel-id': headers['x-goog-channel-id'],
      'x-goog-channel-token': headers['x-goog-channel-token'],
      'x-goog-resource-state': headers['x-goog-resource-state'],
      'x-goog-resource-id': headers['x-goog-resource-id']
    });

    // Google sends a sync notification first to verify the endpoint
    if (headers['x-goog-resource-state'] === 'sync') {
      console.log('[Calendar Webhook] Sync notification received - endpoint verified');
      res.status(200).send();
      return;
    }

    // Extract user ID from token (we set userId as token when creating watch channel)
    const userId = headers['x-goog-channel-token'] as string;
    if (!userId) {
      console.error('[Calendar Webhook] No user ID in token');
      res.status(400).send('Missing user ID');
      return;
    }

    // Verify user exists and has calendar connected
    const user = await UserModel.findById(userId).select('googleCalendar');
    if (!user || !user.googleCalendar?.connected) {
      console.error(`[Calendar Webhook] User ${userId} not found or calendar not connected`);
      res.status(404).send('User not found or calendar not connected');
      return;
    }

    // Verify this is our watch channel
    const channelId = headers['x-goog-channel-id'] as string;
    const resourceId = headers['x-goog-resource-id'] as string;
    
    if (user.googleCalendar.watchChannelId !== channelId || 
        user.googleCalendar.watchResourceId !== resourceId) {
      console.warn(`[Calendar Webhook] Channel ID or Resource ID mismatch for user ${userId}`);
      // Still process the sync, but log the warning
    }

    // Check if channel is expired and renew if needed
    if (await isChannelExpired(userId)) {
      console.log(`[Calendar Webhook] Channel expired for user ${userId}, renewing...`);
      try {
        await setupWatchChannel(userId);
      } catch (error) {
        console.error(`[Calendar Webhook] Error renewing channel for user ${userId}:`, error);
        // Continue with sync even if renewal fails
      }
    }

    const resourceState = headers['x-goog-resource-state'] as string;
    console.log(`[Calendar Webhook] Processing ${resourceState} notification for user ${userId}`);

    // Sync calendar events to update time slots
    // Use the stored sync token for incremental sync
    const syncToken = user.googleCalendar.syncToken;
    await syncCalendarEventsToTimeSlots(userId, syncToken || undefined);

    console.log(`[Calendar Webhook] Successfully processed notification for user ${userId}`);

    // Always return 200 to acknowledge receipt
    res.status(200).send();
  } catch (error) {
    console.error('[Calendar Webhook] Error processing webhook:', error);
    if (error instanceof Error) {
      console.error('[Calendar Webhook] Error details:', error.message, error.stack);
    }
    // Still return 200 to prevent Google from retrying
    // We'll handle errors gracefully and log them
    res.status(200).send();
  }
};

/**
 * Handle watch channel expiration
 * When a channel expires, we need to renew it
 */
export const handleChannelExpiration = async (userId: string): Promise<void> => {
  try {
    console.log(`[Watch Channel] Channel expired for user ${userId}, renewing...`);
    await setupWatchChannel(userId);
    console.log(`[Watch Channel] Channel renewed for user ${userId}`);
  } catch (error) {
    console.error(`[Watch Channel] Error renewing channel for user ${userId}:`, error);
    // Don't throw - we'll try again on next sync
  }
};
