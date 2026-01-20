/**
 * Subscription Tiers Configuration (Backend)
 * 
 * This mirrors the frontend configuration for server-side validation.
 * IMPORTANT: Keep in sync with Frontend/src/core/config/subscriptionTiers.ts
 */

export type SubscriptionTier = 'free' | 'starter' | 'pro';

export type FeatureId = 
  | 'calendar'
  | 'googleCalendar'
  | 'payments'
  | 'prioritySupport'
  | 'unlimitedListings'
  | 'analytics'
  | 'customBranding';

export interface TierLimits {
  listings: number;
  paymentsPerMonth: number;
}

// Tier hierarchy for comparison (higher = more permissions)
export const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
};

// Features available per tier
export const TIER_FEATURES: Record<SubscriptionTier, FeatureId[]> = {
  free: [],
  starter: [
    'calendar',
    'googleCalendar',
    'payments',
  ],
  pro: [
    'calendar',
    'googleCalendar',
    'payments',
    'prioritySupport',
    'unlimitedListings',
    'analytics',
    'customBranding',
  ],
};

// Limits per tier
export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    listings: 1,
    paymentsPerMonth: 0,
  },
  starter: {
    listings: 1,
    paymentsPerMonth: 25,
  },
  pro: {
    listings: Infinity,
    paymentsPerMonth: 200,
  },
};

// Minimum tier required for each feature
export const FEATURE_REQUIRED_TIER: Record<FeatureId, SubscriptionTier> = {
  calendar: 'starter',
  googleCalendar: 'starter',
  payments: 'starter',
  prioritySupport: 'pro',
  unlimitedListings: 'pro',
  analytics: 'pro',
  customBranding: 'pro',
};

/**
 * Check if a tier has access to a feature
 */
export const tierHasFeature = (tier: SubscriptionTier, feature: FeatureId): boolean => {
  return TIER_FEATURES[tier]?.includes(feature) ?? false;
};

/**
 * Check if tier meets minimum requirement
 */
export const tierMeetsMinimum = (currentTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean => {
  return TIER_HIERARCHY[currentTier] >= TIER_HIERARCHY[requiredTier];
};

/**
 * Get the limit value for a tier
 */
export const getTierLimit = (tier: SubscriptionTier, limitKey: keyof TierLimits): number => {
  return TIER_LIMITS[tier]?.[limitKey] ?? 0;
};

/**
 * Get the minimum tier required for a feature
 */
export const getRequiredTier = (feature: FeatureId): SubscriptionTier => {
  return FEATURE_REQUIRED_TIER[feature] ?? 'pro';
};
