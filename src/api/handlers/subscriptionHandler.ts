import { Request } from 'express';
import { paypalClient } from '../../config/paypalSubscriptionClient.js';
import { UserModel } from '../../models/userModel.js';
import { SubscriptionModel } from '../../models/subscriptionModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import { PayPalSubscriptionResponse } from '../../types/paypalSubscriptionResponse.js';
import { CreateInvoiceData, createInvoice } from './invoiceHandler.js';
import { sendSubscriptionConfirmation } from './emailHandler.js';

interface PayPalErrorDetails {
    issue: string;
    description: string;
  }
  
  interface PayPalErrorResponse {
    message?: string;
    name?: string;
    details?: PayPalErrorDetails[];
  }

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
    const { subscriptionId, paypalSubscriptionId, subscriptionDetails } = req.body;
  
    if (!subscriptionId || !paypalSubscriptionId) {
      throw new ExpressError('Subscription ID and PayPal Subscription ID are required', 400);
    }
  
    try {
      // Verify the subscription status from the provided details
      if (subscriptionDetails?.status !== 'ACTIVE') {
        throw new ExpressError('Subscription not active in PayPal', 400);
      }
  
      // Find subscription by MongoDB ID
      const subscription = await SubscriptionModel.findOne({
        _id: subscriptionId
      });
  
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

  
      // Update subscription with PayPal details
      subscription.paypalSubscriptionId = paypalSubscriptionId;
      subscription.status = 'ACTIVE';
      subscription.startDate = new Date();
      subscription.updatedAt = new Date();
      subscription.paypalDetails = subscriptionDetails;
      subscription.planName = plan.name;
      subscription.customerName = user.name;
      subscription.customerEmail = user.email;
      await subscription.save();
      
  
      // Update user's subscription status
      await UserModel.findByIdAndUpdate(subscription.userId, {
        subscriptionStatus: 'ACTIVE',
        subscriptionId: subscription._id
      });
  
      return {
        subscription,
        paypalDetails: subscriptionDetails
      };
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
  
    try {
      // If subscription is already cancelled, just return it
      if (subscription.status === 'CANCELLED') {
        return subscription;
      }

      // Cancel subscription in PayPal if we have a PayPal subscription ID
      if (subscription.paypalSubscriptionId) {
        try {
          // First verify if the subscription exists and is active in PayPal
          const subscriptionDetails = await paypalClient.request(
            `/v1/billing/subscriptions/${subscription.paypalSubscriptionId}`
          );

          // Only attempt to cancel if it's not already cancelled in PayPal
          if (subscriptionDetails.status !== 'CANCELLED') {
            await paypalClient.request(
              `/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/cancel`,
              'POST',
              {
                reason: 'Customer requested cancellation'
              }
            );
          }
        } catch (error: unknown) {
          console.error('PayPal cancellation error:', error);
          
          if (error instanceof Error) {
            // Check for specific PayPal error conditions
            const errorMessage = error.message.toLowerCase();
            
            if (errorMessage.includes('resource_not_found') || 
                errorMessage.includes('already cancelled') ||
                errorMessage.includes('invalid resource id')) {
              console.log('Proceeding with local cancellation due to PayPal status:', error.message);
            } else if (errorMessage.includes('semantically incorrect')) {
              // This likely means the subscription is already cancelled in PayPal
              console.log('Subscription appears to be already cancelled in PayPal');
            } else {
              throw error;
            }
          } else {
            throw new Error('Unknown PayPal error occurred');
          }
        }
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
    } catch (error: unknown) {
      console.error('Error canceling subscription:', error);
      
      if (error instanceof Error) {
        throw new ExpressError(
          'Failed to cancel subscription: ' + error.message,
          500
        );
      } else {
        throw new ExpressError(
          'Failed to cancel subscription: Unknown error',
          500
        );
      }
    }
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

  console.log('Webhook received:', {
    headers: req.headers,
    body: req.body
  });

  if (!event_type || !resource) {
    throw new ExpressError('Invalid webhook data', 400);
  }



  const subscriptionId = resource.id || 
  resource.billing_agreement_id || 
  resource.subscription_id;

  if (event_type === 'BILLING.SUBSCRIPTION.CREATED') {
    console.log('New subscription created in PayPal:', subscriptionId);
    return { received: true };
  }

   let subscription;
   if (subscriptionId) {
  subscription = await SubscriptionModel.findOne({
    paypalSubscriptionId: subscriptionId
  });
}

if (!subscription) {
    console.log(`Subscription not found for event ${event_type}. PayPal ID:`, subscriptionId);
    return { received: true };
  }

  switch (event_type) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
        case 'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED':

        
      subscription.status = 'ACTIVE';
      await subscription.save();

      await UserModel.findByIdAndUpdate(subscription.userId, {
        subscriptionStatus: 'ACTIVE'
      });


    if (subscription) {
        try {
          const user = await UserModel.findById(subscription.userId);
          if (!user) {
            console.error('User not found for subscription:', subscription._id);
            break;
          }
    
          // Create invoice
          const invoiceData: CreateInvoiceData = {
            type: 300,
            client: {
              name: user.name,
              email: user.email as string
            },
            income: [{
              description: `${subscription.planId === 'pro' ? 'Professional' : 'Starter'} Plan Subscription`,
              quantity: 1,
              price: subscription.planId === 'pro' ? 149 : 79
            }],
            vatType: 'NONE',
            currency: 'ILS',
            remarks: `Subscription Payment - ID: ${subscription.paypalSubscriptionId}`,
            lang: 'he',
            paymentType: 3
          };
    
          const invoiceResponse = await createInvoice(invoiceData);
    
          // Send confirmation email
          await sendSubscriptionConfirmation(user.email as string, {
            customerName: user.name,
            planName: subscription.planId === 'pro' ? 'Professional Plan' : 'Starter Plan',
            planPrice: subscription.planId === 'pro' ? 149 : 79,
            subscriptionId: subscription.paypalSubscriptionId || '',
            startDate: new Date(),
            invoiceUrl: invoiceResponse.url.he
          });
        } catch (error) {
          console.error('Error processing payment completion:', error);
        }
      }
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
    // Log unknown event types instead of throwing error
    console.log('Unhandled webhook event type:', event_type);
    return { received: true };
}

  subscription.updatedAt = new Date();
  await subscription.save();

  console.log('Webhook processed successfully:', {
    eventType: event_type,
    subscriptionId: subscription?._id
  });

  return { received: true };
});

export default {
  createSubscription,
  activateSubscription,
  cancelSubscription,
  getSubscriptionDetails,
  handlePayPalWebhook
};