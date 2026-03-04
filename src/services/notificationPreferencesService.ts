import { NotificationPreferencesModel, NotificationPreferencesDoc } from '../models/notificationPreferencesModel.js';
import { NotificationCategory } from '../types/notification.js';

/**
 * Get notification preferences for a user.
 * Creates defaults if none exist.
 */
export const getPreferences = async (userId: string): Promise<NotificationPreferencesDoc> => {
  let prefs = await NotificationPreferencesModel.findOne({ userId });
  if (!prefs) {
    prefs = await NotificationPreferencesModel.create({ userId });
  }
  return prefs;
};

/**
 * Update notification preferences for a user.
 */
export const updatePreferences = async (
  userId: string,
  updates: Partial<Pick<NotificationPreferencesDoc, 'channels' | 'perCategory' | 'quietHours'>>
): Promise<NotificationPreferencesDoc> => {
  const prefs = await NotificationPreferencesModel.findOneAndUpdate(
    { userId },
    { $set: updates },
    { new: true, upsert: true, runValidators: true }
  );
  return prefs!;
};

/**
 * Check if a specific channel is enabled for a given category and user.
 * Returns { inApp, email, push } booleans.
 */
export const getEffectiveChannels = async (
  userId: string,
  category: NotificationCategory
): Promise<{ inApp: boolean; email: boolean; push: boolean }> => {
  const prefs = await getPreferences(userId);

  const globalChannels = prefs.channels;
  const categoryPrefs = prefs.perCategory[category];

  return {
    // inApp is always on (can't be disabled)
    inApp: true,
    email: globalChannels.email && categoryPrefs.email,
    push: globalChannels.push && categoryPrefs.push,
  };
};

/**
 * Check if we're currently in the user's quiet hours.
 */
export const isInQuietHours = async (userId: string): Promise<boolean> => {
  const prefs = await getPreferences(userId);
  if (!prefs.quietHours.enabled) return false;

  const { start, end, timezone } = prefs.quietHours;

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
    const currentTime = formatter.format(now);

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }
    return currentTime >= start && currentTime < end;
  } catch {
    return false;
  }
};
