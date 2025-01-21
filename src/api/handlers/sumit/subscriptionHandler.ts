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
        starter: { name: 'Starter Plan', price: 79 },
        pro: { name: 'Professional Plan', price: 149 }
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
      await subscription.save();

      await processSubscriptionEmailAndInvoice(subscription, {
        type: 'payment',
        remarks: 'Recurring Subscription Payment'
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

export default {
  createSubscription,
  activateSubscription,
  getSubscriptionDetails,
  cancelSubscription,
  handleSumitWebhook
};