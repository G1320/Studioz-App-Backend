import axios from 'axios';
import { SubscriptionModel } from '../models/sumitModels/subscriptionModel.js';
import { UserModel } from '../models/userModel.js';
import { saveSumitInvoice } from '../utils/sumitUtils.js';

// Email notification functions - these log for now until Brevo templates are set up
const sendTrialEndingEmail = async (email: string, details: any) => {
  console.log('[Trial Service] Would send trial ending email to:', email, details);
  // TODO: Implement with sendTemplateEmail once Brevo template is created
};

const sendTrialChargeFailedEmail = async (email: string, details: any) => {
  console.log('[Trial Service] Would send trial charge failed email to:', email, details);
  // TODO: Implement with sendTemplateEmail once Brevo template is created
};

const SUMIT_API_URL = 'https://api.sumit.co.il';
const COMPANY_ID = process.env.SUMIT_COMPANY_ID;
const API_KEY = process.env.SUMIT_API_KEY;

// Plan configuration
const SUBSCRIPTION_PLANS = {
  starter: { name: 'Starter Plan', price: 49 },
  pro: { name: 'Professional Plan', price: 99 }
} as const;

interface ProcessResult {
  processed: number;
  charged: number;
  failed: number;
  errors: string[];
}

/**
 * Process all trials that have expired and charge them
 * Called by the scheduler hourly
 */
export const processExpiringTrials = async (): Promise<ProcessResult> => {
  const result: ProcessResult = {
    processed: 0,
    charged: 0,
    failed: 0,
    errors: []
  };

  try {
    // Find all trial subscriptions that have ended
    const expiredTrials = await SubscriptionModel.find({
      status: 'TRIAL',
      trialEndDate: { $lte: new Date() }
    });

    console.log(`[Trial Service] Found ${expiredTrials.length} expired trials to process`);

    for (const subscription of expiredTrials) {
      result.processed++;

      try {
        const chargeResult = await chargeTrialSubscription(subscription);
        
        if (chargeResult.success) {
          result.charged++;
        } else {
          result.failed++;
          result.errors.push(`Subscription ${subscription._id}: ${chargeResult.error}`);
        }
      } catch (error: any) {
        result.failed++;
        result.errors.push(`Subscription ${subscription._id}: ${error.message}`);
      }
    }

    return result;
  } catch (error: any) {
    console.error('[Trial Service] Error processing expiring trials:', error);
    result.errors.push(`General error: ${error.message}`);
    return result;
  }
};

/**
 * Charge a single trial subscription
 */
const chargeTrialSubscription = async (subscription: any): Promise<{
  success: boolean;
  error?: string;
  paymentId?: string;
}> => {
  if (!subscription.sumitCustomerId) {
    return {
      success: false,
      error: 'No saved payment method'
    };
  }

  const planConfig = SUBSCRIPTION_PLANS[subscription.planId as keyof typeof SUBSCRIPTION_PLANS];
  if (!planConfig) {
    return {
      success: false,
      error: 'Invalid plan configuration'
    };
  }

  // Increment charge attempts
  subscription.trialChargeAttempts = (subscription.trialChargeAttempts || 0) + 1;

  try {
    // Create the recurring subscription in Sumit using the saved customer
    const response = await axios.post(
      `${SUMIT_API_URL}/billing/recurring/charge/`,
      {
        Customer: {
          ID: parseInt(subscription.sumitCustomerId),
          SearchMode: 1
        },
        Items: [{
          Item: {
            Name: planConfig.name,
            Duration_Months: 1
          },
          Quantity: 1,
          UnitPrice: planConfig.price,
          Description: `${planConfig.name} - After ${subscription.trialDurationDays || 7} day trial`,
          Recurrence: 12
        }],
        VATIncluded: true,
        OnlyDocument: false,
        SendDocumentByEmail: true,
        Credentials: {
          CompanyID: COMPANY_ID,
          APIKey: API_KEY
        }
      }
    );

    if (response?.data?.Data?.Payment?.ValidPayment) {
      // Update subscription to ACTIVE
      subscription.status = 'ACTIVE';
      subscription.isTrial = false;
      subscription.sumitPaymentId = response.data.Data.Payment.ID;
      subscription.sumitPaymentDetails = response.data.Data;
      subscription.sumitRecurringItemIds = response.data.Data.RecurringCustomerItemIDs || [];
      await subscription.save();

      // Update user's subscription status
      await UserModel.findByIdAndUpdate(subscription.userId, {
        subscriptionStatus: 'ACTIVE'
      });

      // Save invoice record
      saveSumitInvoice(response.data.Data, {
        customerName: subscription.customerName,
        customerEmail: subscription.customerEmail,
        description: `${planConfig.name} - First charge after trial`
      });

      console.log(`[Trial Service] Successfully charged trial subscription ${subscription._id}`);

      return {
        success: true,
        paymentId: response.data.Data.Payment.ID
      };
    } else {
      // Payment failed
      const errorMessage = response?.data?.Data?.Payment?.StatusDescription || 'Payment failed';
      
      subscription.trialChargeFailedAt = new Date();
      
      // After 3 failed attempts, mark as TRIAL_ENDED
      if (subscription.trialChargeAttempts >= 3) {
        subscription.status = 'TRIAL_ENDED';
        await UserModel.findByIdAndUpdate(subscription.userId, {
          subscriptionStatus: 'TRIAL_ENDED'
        });
        
        // Send notification about trial ending due to payment failure
        try {
          await sendTrialChargeFailedEmail(subscription.customerEmail, {
            customerName: subscription.customerName,
            planName: planConfig.name,
            subscriptionId: subscription._id.toString()
          });
        } catch (emailError) {
          console.error('[Trial Service] Failed to send charge failed email:', emailError);
        }
      }
      
      await subscription.save();

      console.log(`[Trial Service] Failed to charge trial subscription ${subscription._id}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage
      };
    }
  } catch (error: any) {
    subscription.trialChargeAttempts = (subscription.trialChargeAttempts || 0) + 1;
    subscription.trialChargeFailedAt = new Date();
    await subscription.save();

    console.error(`[Trial Service] Error charging trial ${subscription._id}:`, error.response?.data || error);

    return {
      success: false,
      error: error.response?.data?.UserErrorMessage || error.message
    };
  }
};

/**
 * Send reminder emails to users whose trial is ending soon
 * Called daily by the scheduler
 */
export const sendTrialEndingReminders = async (): Promise<{
  oneDayReminders: number;
  threeDayReminders: number;
  errors: string[];
}> => {
  const result = {
    oneDayReminders: 0,
    threeDayReminders: 0,
    errors: [] as string[]
  };

  try {
    const now = new Date();
    
    // Subscriptions ending in ~1 day (next 24-48 hours)
    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
    const twoDaysFromNow = new Date(now);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    // Subscriptions ending in ~3 days (next 72-96 hours)
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const fourDaysFromNow = new Date(now);
    fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);

    // Get 1-day warning subscriptions
    const oneDayWarnings = await SubscriptionModel.find({
      status: 'TRIAL',
      trialEndDate: { 
        $gte: oneDayFromNow, 
        $lt: twoDaysFromNow 
      }
    });

    // Get 3-day warning subscriptions
    const threeDayWarnings = await SubscriptionModel.find({
      status: 'TRIAL',
      trialEndDate: { 
        $gte: threeDaysFromNow, 
        $lt: fourDaysFromNow 
      }
    });

    console.log(`[Trial Service] Sending reminders: ${oneDayWarnings.length} 1-day, ${threeDayWarnings.length} 3-day`);

    // Send 1-day reminders
    for (const subscription of oneDayWarnings) {
      try {
        const planConfig = SUBSCRIPTION_PLANS[subscription.planId as keyof typeof SUBSCRIPTION_PLANS];
        await sendTrialEndingEmail(subscription.customerEmail || '', {
          customerName: subscription.customerName || 'Customer',
          planName: planConfig?.name || subscription.planName || 'Subscription',
          planPrice: planConfig?.price || 0,
          trialEndDate: subscription.trialEndDate || new Date(),
          daysRemaining: 1
        });
        result.oneDayReminders++;
      } catch (error: any) {
        result.errors.push(`1-day reminder for ${subscription._id}: ${error.message}`);
      }
    }

    // Send 3-day reminders
    for (const subscription of threeDayWarnings) {
      try {
        const planConfig = SUBSCRIPTION_PLANS[subscription.planId as keyof typeof SUBSCRIPTION_PLANS];
        await sendTrialEndingEmail(subscription.customerEmail || '', {
          customerName: subscription.customerName || 'Customer',
          planName: planConfig?.name || subscription.planName || 'Subscription',
          planPrice: planConfig?.price || 0,
          trialEndDate: subscription.trialEndDate || new Date(),
          daysRemaining: 3
        });
        result.threeDayReminders++;
      } catch (error: any) {
        result.errors.push(`3-day reminder for ${subscription._id}: ${error.message}`);
      }
    }

    return result;
  } catch (error: any) {
    console.error('[Trial Service] Error sending reminders:', error);
    result.errors.push(`General error: ${error.message}`);
    return result;
  }
};

/**
 * Get all subscriptions with trials ending within specified days
 * Used for admin dashboard or manual processing
 */
export const getTrialsEndingSoon = async (days: number = 3): Promise<any[]> => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  return SubscriptionModel.find({
    status: 'TRIAL',
    trialEndDate: { $lte: endDate }
  }).populate('userId', 'name email');
};

/**
 * Manually trigger a trial charge (for admin use or retries)
 */
export const manuallyChargeTrialSubscription = async (subscriptionId: string): Promise<{
  success: boolean;
  error?: string;
  paymentId?: string;
}> => {
  const subscription = await SubscriptionModel.findById(subscriptionId);
  
  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  if (subscription.status !== 'TRIAL' && subscription.status !== 'TRIAL_ENDED') {
    return { success: false, error: `Cannot charge subscription with status: ${subscription.status}` };
  }

  // Reset status to TRIAL for retry
  if (subscription.status === 'TRIAL_ENDED') {
    subscription.status = 'TRIAL';
    await subscription.save();
  }

  return chargeTrialSubscription(subscription);
};
