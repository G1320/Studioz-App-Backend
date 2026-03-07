import { Request, Response } from 'express';
import { processWebhookNotification } from '../../services/googleCalendarService.js';

/**
 * Handle Google Calendar push notification webhook
 * POST /api/webhooks/google-calendar
 *
 * Google sends these headers:
 * - X-Goog-Channel-ID: The channel ID we created
 * - X-Goog-Resource-ID: The resource being watched
 * - X-Goog-Resource-State: 'sync' (initial) or 'exists' (event changed)
 * - X-Goog-Channel-Token: The token we set (userId)
 *
 * IMPORTANT: Must respond 200 quickly, otherwise Google will retry and eventually stop notifications
 */
const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  // Always respond 200 immediately - Google retries on non-2xx
  res.status(200).send();

  const channelId = req.headers['x-goog-channel-id'] as string;
  const resourceId = req.headers['x-goog-resource-id'] as string;
  const resourceState = req.headers['x-goog-resource-state'] as string;

  if (!channelId || !resourceId) {
    console.log('[GoogleCalendarWebhook] Missing channel or resource ID');
    return;
  }

  // 'sync' is the initial verification call - no action needed
  if (resourceState === 'sync') {
    console.log('[GoogleCalendarWebhook] Received sync verification for channel:', channelId);
    return;
  }

  // 'exists' means events were created/updated/deleted
  if (resourceState === 'exists') {
    console.log('[GoogleCalendarWebhook] Event change detected for channel:', channelId);
    // Process async - don't block the response
    processWebhookNotification(channelId, resourceId).catch(err => {
      console.error('[GoogleCalendarWebhook] Error processing notification:', err);
    });
  }
};

const googleCalendarWebhookHandler = {
  handleWebhook
};

export default googleCalendarWebhookHandler;
