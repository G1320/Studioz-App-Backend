import { UsageModel } from '../models/usageModel.js';
import { UserModel } from '../models/userModel.js';
import { ItemModel } from '../models/itemModel.js';
import { SubscriptionModel } from '../models/sumitModels/subscriptionModel.js';
import { getTierLimit, SubscriptionTier } from '../config/subscriptionTiers.js';

/**
 * Get current month in format "YYYY-MM"
 */
const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const usageService = {
  /**
   * Get user's current subscription tier
   */
  async getUserTier(userId: string): Promise<SubscriptionTier> {
    const user = await UserModel.findById(userId);
    
    if (!user?.subscriptionId || user.subscriptionStatus !== 'ACTIVE') {
      return 'free';
    }
    
    const subscription = await SubscriptionModel.findById(user.subscriptionId);
    
    if (!subscription || subscription.status !== 'ACTIVE') {
      return 'free';
    }
    
    // Handle trial subscriptions - they get starter features
    if (subscription.isTrial && subscription.status === 'ACTIVE') {
      return (subscription.planId as SubscriptionTier) || 'starter';
    }
    
    return (subscription.planId as SubscriptionTier) || 'free';
  },

  /**
   * Get or create usage record for current month
   */
  async getMonthlyUsage(userId: string) {
    const month = getCurrentMonth();
    
    let usage = await UsageModel.findOne({ userId, month });
    
    if (!usage) {
      usage = await UsageModel.create({ 
        userId, 
        month,
        paymentsProcessed: 0,
        paymentsTotal: 0,
        listingsCreated: 0
      });
    }
    
    return usage;
  },

  /**
   * Increment payment count after successful payment
   */
  async incrementPaymentCount(userId: string, amount: number): Promise<void> {
    const month = getCurrentMonth();
    
    await UsageModel.findOneAndUpdate(
      { userId, month },
      {
        $inc: { 
          paymentsProcessed: 1, 
          paymentsTotal: amount 
        },
        $set: { lastUpdated: new Date() }
      },
      { upsert: true, new: true }
    );
  },

  /**
   * Check if user can process another payment
   * Returns status and remaining count
   */
  async canProcessPayment(userId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    remaining: number;
    tier: SubscriptionTier;
  }> {
    const tier = await this.getUserTier(userId);
    const limit = getTierLimit(tier, 'paymentsPerMonth');
    const usage = await this.getMonthlyUsage(userId);
    const current = usage.paymentsProcessed;
    
    return {
      allowed: limit === Infinity || current < limit,
      current,
      limit,
      remaining: limit === Infinity ? Infinity : Math.max(0, limit - current),
      tier
    };
  },

  /**
   * Get current total listing count for user across all studios
   */
  async getListingCount(userId: string): Promise<number> {
    const user = await UserModel.findById(userId);
    
    if (!user?.studios?.length) {
      return 0;
    }
    
    const count = await ItemModel.countDocuments({
      studioId: { $in: user.studios }
    });
    
    return count;
  },

  /**
   * Check if user can create another listing
   */
  async canCreateListing(userId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    tier: SubscriptionTier;
  }> {
    const tier = await this.getUserTier(userId);
    const limit = getTierLimit(tier, 'listings');
    const current = await this.getListingCount(userId);
    
    return {
      allowed: limit === Infinity || current < limit,
      current,
      limit,
      tier
    };
  },

  /**
   * Get full usage stats for dashboard display
   */
  async getUsageStats(userId: string) {
    const tier = await this.getUserTier(userId);
    const usage = await this.getMonthlyUsage(userId);
    const listingCount = await this.getListingCount(userId);
    
    const user = await UserModel.findById(userId);
    const subscription = user?.subscriptionId 
      ? await SubscriptionModel.findById(user.subscriptionId)
      : null;
    
    return {
      tier,
      payments: {
        current: usage.paymentsProcessed,
        limit: getTierLimit(tier, 'paymentsPerMonth'),
        total: usage.paymentsTotal,
        month: usage.month
      },
      listings: {
        current: listingCount,
        limit: getTierLimit(tier, 'listings')
      },
      subscription: subscription ? {
        status: subscription.status,
        planId: subscription.planId,
        planName: subscription.planName,
        isTrial: subscription.isTrial,
        trialEndDate: subscription.trialEndDate,
        startDate: subscription.startDate,
        endDate: subscription.endDate
      } : null
    };
  },

  /**
   * Increment listing count when a new item is created
   * (For tracking purposes - actual limit is checked via getListingCount)
   */
  async incrementListingCount(userId: string): Promise<void> {
    const month = getCurrentMonth();
    
    await UsageModel.findOneAndUpdate(
      { userId, month },
      {
        $inc: { listingsCreated: 1 },
        $set: { lastUpdated: new Date() }
      },
      { upsert: true }
    );
  },

  /**
   * Clean up old usage records (keep last 12 months)
   * Run as a scheduled job
   */
  async cleanupOldRecords(): Promise<number> {
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const cutoffMonth = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}`;
    
    const result = await UsageModel.deleteMany({
      month: { $lt: cutoffMonth }
    });
    
    return result.deletedCount;
  }
};

export default usageService;
