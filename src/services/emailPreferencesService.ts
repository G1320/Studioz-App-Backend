import { UserModel } from '../models/userModel.js';

/**
 * Email category types that can be controlled by user preferences
 */
export type EmailCategory =
  | 'bookingConfirmations'
  | 'bookingReminders'
  | 'bookingCancellations'
  | 'paymentReceipts'
  | 'payoutNotifications'
  | 'subscriptionUpdates'
  | 'promotionalEmails'
  | 'reviewRequests';

/**
 * Default email preferences for new users or users without preferences set
 */
export const DEFAULT_EMAIL_PREFERENCES = {
  enabled: true,
  bookingConfirmations: true,
  bookingReminders: true,
  bookingCancellations: true,
  paymentReceipts: true,
  payoutNotifications: true,
  subscriptionUpdates: true,
  promotionalEmails: true,
  reviewRequests: true
};

/**
 * Check if a user wants to receive a specific type of email
 * @param userId - The user's ID or email
 * @param category - The email category to check
 * @returns true if the email should be sent, false if user has disabled it
 */
export const shouldSendEmail = async (
  userIdOrEmail: string,
  category: EmailCategory
): Promise<boolean> => {
  try {
    // Try to find user by ID first, then by email
    let user = await UserModel.findById(userIdOrEmail).select('emailPreferences');

    if (!user) {
      user = await UserModel.findOne({ email: userIdOrEmail }).select('emailPreferences');
    }

    // If user not found, allow email (guest or unknown user)
    if (!user) {
      return true;
    }

    const prefs = user.emailPreferences;

    // If no preferences set, use defaults (send emails)
    if (!prefs) {
      return true;
    }

    // Check master toggle first
    if (prefs.enabled === false) {
      return false;
    }

    // Check specific category preference
    const categoryPref = prefs[category];

    // If category preference is undefined, default to true
    return categoryPref !== false;
  } catch (error) {
    // On error, default to sending the email
    console.error('Error checking email preferences:', error);
    return true;
  }
};

/**
 * Get a user's email preferences
 * @param userId - The user's ID
 * @returns The user's email preferences or defaults
 */
export const getEmailPreferences = async (userId: string) => {
  try {
    const user = await UserModel.findById(userId).select('emailPreferences');

    if (!user || !user.emailPreferences) {
      return DEFAULT_EMAIL_PREFERENCES;
    }

    // Merge with defaults to ensure all fields exist
    return {
      ...DEFAULT_EMAIL_PREFERENCES,
      ...user.emailPreferences
    };
  } catch (error) {
    console.error('Error getting email preferences:', error);
    return DEFAULT_EMAIL_PREFERENCES;
  }
};

/**
 * Update a user's email preferences
 * @param userId - The user's ID
 * @param preferences - Partial preferences to update
 * @returns The updated preferences
 */
export const updateEmailPreferences = async (
  userId: string,
  preferences: Partial<typeof DEFAULT_EMAIL_PREFERENCES>
) => {
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  // Initialize preferences if they don't exist
  if (!user.emailPreferences) {
    user.emailPreferences = { ...DEFAULT_EMAIL_PREFERENCES };
  }

  // Update only the provided preferences
  Object.assign(user.emailPreferences, preferences);

  await user.save();

  return user.emailPreferences;
};

/**
 * Mapping of email handler functions to their categories
 * Use this to determine which category an email belongs to
 */
export const EMAIL_CATEGORY_MAP: Record<string, EmailCategory> = {
  // Booking emails
  sendBookingConfirmedCustomer: 'bookingConfirmations',
  sendNewBookingVendor: 'bookingConfirmations',
  sendBookingReminder: 'bookingReminders',
  sendBookingCancelledCustomer: 'bookingCancellations',
  sendBookingCancelledVendor: 'bookingCancellations',
  sendBookingModified: 'bookingConfirmations',

  // Payment emails
  sendOrderConfirmation: 'paymentReceipts',
  sendRefundConfirmation: 'paymentReceipts',
  sendOrderCancelled: 'paymentReceipts',
  sendPayoutNotification: 'payoutNotifications',

  // Subscription emails
  sendSubscriptionConfirmation: 'subscriptionUpdates',
  sendTrialStartedEmail: 'subscriptionUpdates',
  sendTrialEndingEmail: 'subscriptionUpdates',
  sendTrialChargeFailedEmail: 'subscriptionUpdates',
  sendSubscriptionPaymentFailed: 'subscriptionUpdates',
  sendSubscriptionExpiring: 'subscriptionUpdates',
  sendSubscriptionUpgraded: 'subscriptionUpdates',
  sendSubscriptionDowngraded: 'subscriptionUpdates',

  // Review emails
  sendReviewRequest: 'reviewRequests',

  // Document emails (treat as payment receipts)
  sendDocumentEmail: 'paymentReceipts'
};

export default {
  shouldSendEmail,
  getEmailPreferences,
  updateEmailPreferences,
  DEFAULT_EMAIL_PREFERENCES,
  EMAIL_CATEGORY_MAP
};
