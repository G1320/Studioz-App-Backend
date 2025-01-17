import { UserModel } from '../models/userModel.js';
import { CreateInvoiceData, createInvoice } from '../api/handlers/invoiceHandler.js';
import { sendSubscriptionConfirmation } from '../api/handlers/emailHandler.js';

interface ProcessSubscriptionEmailOptions {
  type: 'activation' | 'payment' | 'cancellation';
  remarks?: string;
}

export const processSubscriptionEmailAndInvoice = async (
  subscription: any,
  options: ProcessSubscriptionEmailOptions
) => {
  try {
    const user = await UserModel.findById(subscription.userId);
    if (!user) {
      throw new Error(`User not found for subscription: ${subscription._id}`);
    }

    // Get plan details
    const plans = {
      starter: { name: 'Starter Plan', price: 79 },
      pro: { name: 'Professional Plan', price: 149 }
    };

    const plan = plans[subscription.planId as keyof typeof plans];
    if (!plan) {
      throw new Error(`Invalid plan ID: ${subscription.planId}`);
    }

    let invoiceUrl;
    
    // Only create invoice for payment events
    if (options.type === 'payment') {
      const invoiceData: CreateInvoiceData = {
        type: 300,
        client: {
          name: user.name,
          email: user.email as string
        },
        income: [{
          description: `${plan.name} Subscription Payment`,
          quantity: 1,
          price: plan.price
        }],
        vatType: 'NONE',
        currency: 'ILS',
        remarks: options.remarks || `Subscription Payment - ID: ${subscription.paypalSubscriptionId}`,
        lang: 'he',
        paymentType: 3
      };

      const invoiceResponse = await createInvoice(invoiceData);
      invoiceUrl = invoiceResponse.url.he;
    }
    // Send confirmation email
    await sendSubscriptionConfirmation(
      user.email as string,
      {
        customerName: user.name,
        planName: plan.name,
        planPrice: plan.price,
        subscriptionId: subscription.paypalSubscriptionId || '',
        startDate: new Date(),
        invoiceUrl: invoiceUrl
      },
      options.type
    );

    // Update user's subscription status if needed
    await UserModel.findByIdAndUpdate(subscription.userId, {
      subscriptionStatus: options.type === 'cancellation' ? 'INACTIVE' : 'ACTIVE',
      subscriptionId: options.type === 'cancellation' ? null : subscription._id
    });

    return invoiceUrl ? { url: { he: invoiceUrl } } : { success: true };;
  } catch (error) {
    console.error(`Error processing subscription ${options.type}:`, error);
    throw error;
  }
};