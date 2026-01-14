import { Request } from 'express';
import { UserModel } from '../../../models/userModel.js';
import { SubscriptionModel } from '../../../models/sumitModels/subscriptionModel.js';
import ExpressError from '../../../utils/expressError.js';
import handleRequest from '../../../utils/requestHandler.js';
import { processSubscriptionEmailAndInvoice } from '../../../services/subscriptionService.js';


const createSubscription = handleRequest(async (req: Request) => {
  const { userId, planId } = req.body;

  if (!userId || !planId) {
    throw new ExpressError('User ID and Plan ID are required', 400);
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ExpressError('User not found', 404);
  }

  const subscription = await SubscriptionModel.create({
    userId,
    planId,
    status: 'PENDING',
    createdAt: new Date()
  });
  
  return subscription;
});

const activateSubscription = handleRequest(async (req: Request) => {
    const { subscriptionId, sumitPaymentResponse } = req.body;
  
    if (!subscriptionId || !sumitPaymentResponse) {
      throw new ExpressError('Subscription ID and Sumit payment response are required', 400);
    }
  
    try {
      if (!sumitPaymentResponse.Payment?.ValidPayment) {
        throw new ExpressError(
          sumitPaymentResponse.Payment?.StatusDescription || 'Payment validation failed',
          400
        );
      }
  
      const subscription = await SubscriptionModel.findOne({_id: subscriptionId});
  
      if (!subscription) {
        throw new ExpressError('Subscription not found', 404);
      }
  
      const user = await UserModel.findById(subscription.userId);
      if (!user) {
        throw new ExpressError('User not found', 404);
      }
  
      const plans = {
        starter: { name: 'Starter Plan', price: 49 },
        pro: { name: 'Professional Plan', price: 99 }
      };
  
      const plan = plans[subscription.planId as keyof typeof plans];
  
      subscription.sumitPaymentId = sumitPaymentResponse.Payment.ID;
      subscription.sumitCustomerId = sumitPaymentResponse.Payment.CustomerID;
      subscription.status = 'ACTIVE';
      subscription.startDate = new Date();
      subscription.updatedAt = new Date();
      subscription.sumitPaymentDetails = sumitPaymentResponse; 
      subscription.planName = plan.name;
      subscription.customerName = user.name;
      subscription.customerEmail = user.email;
      await subscription.save();
  
      await UserModel.findByIdAndUpdate(subscription.userId, {
        subscriptionStatus: 'ACTIVE',
        subscriptionId: subscription._id
      });
  
      return subscription;
      
    } catch (error: any) {
      console.error('Activation error:', error);
      if (error instanceof ExpressError) throw error;
      throw new ExpressError(`Failed to activate subscription: ${error.message}`, 400);
    }
  });

  const getSubscriptionDetails = handleRequest(async (req: Request) => {
    const { subscriptionId } = req.params;

    const subscription = await SubscriptionModel.findById(subscriptionId);
     if (!subscription) {
    throw new ExpressError('Subscription not found', 404);
    }

  return subscription

  })


const cancelSubscription = handleRequest(async (req: Request) => {
  const { subscriptionId } = req.params;

  if (!subscriptionId) {
    throw new ExpressError('Subscription ID is required', 400);
  }

  const subscription = await SubscriptionModel.findById(subscriptionId);
  if (!subscription) {
    throw new ExpressError('Subscription not found', 404);
  }

  try {
    // If subscription is already cancelled, just return it
    if (subscription.status === 'CANCELLED') {
      return subscription;
    }

    // Update local subscription status
    subscription.status = 'CANCELLED';
    subscription.endDate = new Date();
    subscription.updatedAt = new Date();
    await subscription.save();

    // Update user's subscription status
    await UserModel.findByIdAndUpdate(subscription.userId, {
      subscriptionStatus: 'INACTIVE',
      subscriptionId: null
    });

    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw new ExpressError(
      'Failed to cancel subscription: ' + (error instanceof Error ? error.message : 'Unknown error'),
      500
    );
  }
});

const handleSumitWebhook = handleRequest(async (req: Request) => {
  const { EventType, Data } = req.body;

  console.log('Webhook received:', {
    headers: req.headers,
    body: req.body
  });

  if (!EventType || !Data) {
    throw new ExpressError('Invalid webhook data', 400);
  }

  const subscription = await SubscriptionModel.findOne({
    sumitPaymentId: Data.Payment?.ID
  });

  if (!subscription) {
    console.log(`Subscription not found for event ${EventType}`);
    return { received: true };
  }

  switch (EventType) {
    case 'payment.success':
      subscription.status = 'ACTIVE';
      // If this was a trial subscription, mark trial as complete
      if (subscription.isTrial) {
        subscription.isTrial = false;
      }
      await subscription.save();

      await processSubscriptionEmailAndInvoice(subscription, {
        type: 'payment',
        remarks: subscription.trialDurationDays 
          ? `First Payment After ${subscription.trialDurationDays}-Day Trial`
          : 'Recurring Subscription Payment'
      });
      break;

    case 'payment.failed':
      subscription.status = 'PAYMENT_FAILED';
      await subscription.save();

      await UserModel.findByIdAndUpdate(subscription.userId, {
        subscriptionStatus: 'PAYMENT_FAILED'
      });
      break;

    default:
      console.log('Unhandled webhook event type:', EventType);
      return { received: true };
  }

  subscription.updatedAt = new Date();
  await subscription.save();

  console.log('Webhook processed successfully:', {
    eventType: EventType,
    subscriptionId: subscription._id
  });

  return { received: true };
});

/**
 * Get trial status for a user
 * Returns trial info including days remaining
 */
const getTrialStatus = handleRequest(async (req: Request) => {
  const { userId } = req.params;

  if (!userId) {
    throw new ExpressError('User ID is required', 400);
  }

  const subscription = await SubscriptionModel.findOne({
    userId,
    status: 'TRIAL'
  });

  if (!subscription) {
    return {
      hasTrial: false,
      message: 'No active trial found'
    };
  }

  const now = new Date();
  const trialEnd = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;
  const daysRemaining = trialEnd 
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    hasTrial: true,
    subscription: {
      _id: subscription._id,
      planId: subscription.planId,
      planName: subscription.planName,
      status: subscription.status,
      trialEndDate: subscription.trialEndDate,
      daysRemaining,
      hasCard: !!subscription.sumitCustomerId
    }
  };
});

/**
 * Cancel a trial subscription
 * Removes the subscription and saved card
 */
const cancelTrialSubscription = handleRequest(async (req: Request) => {
  const { subscriptionId } = req.params;

  if (!subscriptionId) {
    throw new ExpressError('Subscription ID is required', 400);
  }

  const subscription = await SubscriptionModel.findById(subscriptionId);
  if (!subscription) {
    throw new ExpressError('Subscription not found', 404);
  }

  if (subscription.status !== 'TRIAL') {
    throw new ExpressError('Can only cancel trial subscriptions through this endpoint', 400);
  }

  // Update subscription status
  subscription.status = 'CANCELLED';
  subscription.endDate = new Date();
  subscription.updatedAt = new Date();
  await subscription.save();

  // Update user's subscription status
  await UserModel.findByIdAndUpdate(subscription.userId, {
    subscriptionStatus: 'INACTIVE',
    subscriptionId: null
  });

  // Note: We don't remove the saved card - user may want to use it for other purposes

  return {
    success: true,
    message: 'Trial subscription cancelled',
    subscription
  };
});

export default {
  createSubscription,
  activateSubscription,
  getSubscriptionDetails,
  cancelSubscription,
  handleSumitWebhook,
  getTrialStatus,
  cancelTrialSubscription
};