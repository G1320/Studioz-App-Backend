import { Request } from 'express';
import { paypalClient } from '../../config/paypalSubscriptionClient.js';
import { UserModel } from '../../models/userModel.js';
import { SubscriptionModel } from '../../models/subscriptionModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { PayPalSubscriptionResponse } from '../../types/paypalSubscriptionResponse.js';

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
  const { subscriptionId, paypalSubscriptionId } = req.body;

  if (!subscriptionId || !paypalSubscriptionId) {
    throw new ExpressError('Subscription ID and PayPal Subscription ID are required', 400);
  }

  // First verify the PayPal subscription
  try {
    const response = await paypalClient.request(
      `/v1/billing/subscriptions/${paypalSubscriptionId}`
    );
    
    const paypalSubscription = response as PayPalSubscriptionResponse;
    if (paypalSubscription.status !== 'ACTIVE') {
      throw new ExpressError('Subscription not active in PayPal', 400);
    }

    // Find subscription by MongoDB ID, not PayPal ID
    const subscription = await SubscriptionModel.findOne({
      _id: subscriptionId
    });

    if (!subscription) {
      throw new ExpressError('Subscription not found', 404);
    }

    // Update subscription with PayPal details
    subscription.paypalSubscriptionId = paypalSubscriptionId;
    subscription.status = 'ACTIVE';
    subscription.startDate = new Date();
    subscription.updatedAt = new Date();
    await subscription.save();

    // Update user's subscription status
    await UserModel.findByIdAndUpdate(subscription.userId, {
      subscriptionStatus: 'ACTIVE',
      subscriptionId: subscription._id
    });

    return subscription;
  } catch (error) {
    console.error('Activation error:', error);
    if (error instanceof ExpressError) throw error;
    throw new ExpressError('Failed to activate subscription', 400);
  }
});

const cancelSubscription = handleRequest(async (req: Request) => {
  const { subscriptionId } = req.params;

  if (!subscriptionId) {
    throw new ExpressError('Subscription ID is required', 400);
  }

  const subscription = await SubscriptionModel.findById(subscriptionId);
  if (!subscription) {
    throw new ExpressError('Subscription not found', 404);
  }

  // Cancel subscription in PayPal
  if (subscription.paypalSubscriptionId) {
    await paypalClient.request(
      `/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/cancel`,
      'POST',
      { reason: 'Customer requested cancellation' }
    );
  }

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
});

const getSubscriptionDetails = handleRequest(async (req: Request) => {
  const { subscriptionId } = req.params;

  if (!subscriptionId) {
    throw new ExpressError('Subscription ID is required', 400);
  }

  const subscription = await SubscriptionModel.findById(subscriptionId);
  if (!subscription) {
    throw new ExpressError('Subscription not found', 404);
  }

  // Get additional details from PayPal if available
  let paypalDetails = null;
  if (subscription.paypalSubscriptionId) {
    const response = await paypalClient.request(
      `/v1/billing/subscriptions/${subscription.paypalSubscriptionId}`
    );
    paypalDetails = response as PayPalSubscriptionResponse;
  }

  return {
    subscription,
    paypalDetails
  };
});

const handlePayPalWebhook = handleRequest(async (req: Request) => {
  const { event_type, resource } = req.body;

  if (!event_type || !resource) {
    throw new ExpressError('Invalid webhook data', 400);
  }

  const subscription = await SubscriptionModel.findOne({
    paypalSubscriptionId: resource.id
  });

  if (!subscription) {
    throw new ExpressError('Subscription not found', 404);
  }

  switch (event_type) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
      subscription.status = 'ACTIVE';
      await UserModel.findByIdAndUpdate(subscription.userId, {
        subscriptionStatus: 'ACTIVE'
      });
      break;

    case 'BILLING.SUBSCRIPTION.CANCELLED':
      subscription.status = 'CANCELLED';
      subscription.endDate = new Date();
      await UserModel.findByIdAndUpdate(subscription.userId, {
        subscriptionStatus: 'INACTIVE',
        subscriptionId: null
      });
      break;

    case 'BILLING.SUBSCRIPTION.SUSPENDED':
      subscription.status = 'SUSPENDED';
      await UserModel.findByIdAndUpdate(subscription.userId, {
        subscriptionStatus: 'SUSPENDED'
      });
      break;

    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
      subscription.status = 'PAYMENT_FAILED';
      break;

    default:
      throw new ExpressError('Unhandled webhook event type', 400);
  }

  subscription.updatedAt = new Date();
  await subscription.save();

  return { received: true };
});

export default {
  createSubscription,
  activateSubscription,
  cancelSubscription,
  getSubscriptionDetails,
  handlePayPalWebhook
};