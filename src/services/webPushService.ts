import webpush from 'web-push';
import { PushSubscriptionModel } from '../models/pushSubscriptionModel.js';

// Initialize VAPID keys from environment
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@studioz.co.il';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * Save a push subscription for a user.
 */
export const saveSubscription = async (
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) => {
  return PushSubscriptionModel.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    },
    { upsert: true, new: true }
  );
};

/**
 * Remove a push subscription.
 */
export const removeSubscription = async (userId: string, endpoint: string) => {
  return PushSubscriptionModel.deleteOne({ userId, endpoint });
};

/**
 * Send a push notification to all of a user's subscriptions.
 * Automatically cleans up expired subscriptions (410 response).
 */
export const sendPushToUser = async (
  userId: string,
  payload: { title: string; body: string; icon?: string; actionUrl?: string }
): Promise<number> => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return 0; // Push not configured
  }

  const subscriptions = await PushSubscriptionModel.find({ userId });
  if (subscriptions.length === 0) return 0;

  let sentCount = 0;
  const expiredEndpoints: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        },
        JSON.stringify(payload),
        { TTL: 60 * 60 } // 1 hour TTL
      );
      sentCount++;
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription expired or invalid - queue for deletion
        expiredEndpoints.push(sub.endpoint);
      } else {
        console.error(`[WebPush] Error sending to endpoint ${sub.endpoint}:`, error.message);
      }
    }
  }

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    await PushSubscriptionModel.deleteMany({ endpoint: { $in: expiredEndpoints } });
  }

  return sentCount;
};

/**
 * Get the public VAPID key for client-side subscription.
 */
export const getVapidPublicKey = (): string => {
  return VAPID_PUBLIC_KEY;
};
