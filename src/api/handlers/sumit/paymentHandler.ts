// controllers/payment.controller.ts
import { Request, Response } from 'express';
import axios from 'axios';
import { UserModel } from '../../../models/userModel.js';
import SubscriptionModel from '../../../models/sumitModels/subscriptionModel.js';
import { InvoiceModel } from '../../../models/invoiceModel.js';
import { saveSumitInvoice } from '../../../utils/sumitUtils.js';
import { paymentService } from '../../../services/paymentService.js';
import { usageService } from '../../../services/usageService.js';

const SUMIT_API_URL = 'https://api.sumit.co.il';
const COMPANY_ID = process.env.SUMIT_COMPANY_ID;
const API_KEY = process.env.SUMIT_API_KEY;

// Plan configuration with trial support
const SUBSCRIPTION_PLANS = {
  starter: { name: 'Starter Plan', price: 49, trialDays: 7 },
  pro: { name: 'Professional Plan', price: 99, trialDays: 14 }
} as const;

interface CartItem {
  merchantId: string;
  name: string;
  price: number;
  quantity: number;
}

export const paymentHandler = {
  async processPayment(req: Request, res: Response) {
    try {
      const { singleUseToken, amount, description, customerInfo } = req.body;

      // Call Sumit API to process the payment
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/charge/`,
        {
          SingleUseToken: singleUseToken,
          Amount: amount,
          Description: description,
          Items: [{
            Item: {
              Name: description,
              Price: amount
            },
            Quantity: 1,
            UnitPrice: amount,
            Description: description
          }],
          Customer: {
            Name: customerInfo.customerName,
            EmailAddress: customerInfo.customerEmail,
            SearchMode: 0
          },
          VATIncluded: true,
          SendDocumentByEmail: true,
          Credentials: {
            CompanyID: COMPANY_ID,
            APIKey: API_KEY
          }
        }
      );
      if (response.data.Data.Payment.ValidPayment) {
        // Save invoice record
        saveSumitInvoice(response.data.Data, {
          customerName: customerInfo.customerName,
          customerEmail: customerInfo.customerEmail,
          description: description
        });

        return res.status(200).json({
          success: true,
          data: response.data.Data
        });
      } else {
        return res.status(500).json({
          success: false,
          error: response.data.Data.Payment.StatusDescription || 'Failed to create subscription'
        });
      }
    } catch (error) {

      return res.status(500).json({
        success: false,
        error: 'Failed to process payment'
      });
    }
  },

  async createSubscription(req: Request, res: Response) {
    try {
      const { singleUseToken, planDetails, customerInfo } = req.body;

      // Find any active subscription for this user
      const existingSubscription = await SubscriptionModel.findOne({
        customerEmail: customerInfo.customerEmail,
        status: 'ACTIVE'
      });

      // If there's an active subscription, cancel it first
      if (existingSubscription) {
        try {
          // Cancel the existing subscription in Sumit
          if (existingSubscription.sumitPaymentDetails?.RecurringCustomerItemIDs?.[0]) {
            await axios.post(
              `${SUMIT_API_URL}/billing/recurring/cancel/`,
              {
                Credentials: {
                  CompanyID: COMPANY_ID,
                  APIKey: API_KEY
                },
                Customer: {
                  ID: existingSubscription.sumitCustomerId,
                  Name: existingSubscription.customerName,
                  EmailAddress: existingSubscription.customerEmail,
                  SearchMode: 0
                },
                RecurringCustomerItemID: existingSubscription.sumitPaymentDetails.RecurringCustomerItemIDs[0]
              }
            );
          }

          // Update the existing subscription status
          existingSubscription.status = 'CANCELLED';
          existingSubscription.endDate = new Date();
          existingSubscription.updatedAt = new Date();
          await existingSubscription.save();

          // Update user's subscription status
          await UserModel.findByIdAndUpdate(existingSubscription.userId, {
            subscriptionStatus: 'INACTIVE',
            subscriptionId: null
          });
        } catch (error) {
          console.error('Error cancelling existing subscription:', error);
          return res.status(500).json({
            success: false,
            error: 'Failed to cancel existing subscription'
          });
        }
      }

      // Create new subscription
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/recurring/charge/`,
        {
          SingleUseToken: singleUseToken,
          Customer: {
            SearchMode: 0,
            Name: customerInfo.customerName,
            EmailAddress: customerInfo.customerEmail
          },
          Items: [{
            Item: {
              Name: planDetails.name || "Monthly Subscription",
              Duration_Months: planDetails.durationMonths || 1
            },
            Quantity: 1,
            UnitPrice: planDetails.amount,
            Description: planDetails.description,
            Recurrence: planDetails.recurrence || 12
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
        // Save invoice record
        saveSumitInvoice(response.data.Data, {
          customerName: customerInfo.customerName,
          customerEmail: customerInfo.customerEmail,
          description: planDetails.description || "Subscription"
        });

        // Save the card on the user for future upgrades/use
        const paymentData = response.data.Data;
        if (customerInfo.userId && paymentData.CustomerID) {
          try {
            const lastFourDigits = paymentData.Payment?.PaymentMethod?.CreditCard_LastDigits;
            await UserModel.findByIdAndUpdate(customerInfo.userId, {
              sumitCustomerId: paymentData.CustomerID.toString(),
              savedCardLastFour: lastFourDigits,
              savedCardBrand: 'visa' // Default, could detect from card mask
            });
            console.log('[Subscription] Saved card on user for future use:', {
              userId: customerInfo.userId,
              customerId: paymentData.CustomerID,
              lastFour: lastFourDigits
            });
          } catch (cardSaveError) {
            console.error('[Subscription] Failed to save card on user:', cardSaveError);
            // Don't fail the subscription, just log the error
          }
        }

        return res.status(200).json({
          success: true,
          data: response.data.Data
        });
      } else {
        return res.status(500).json({
          success: false,
          error: response?.data?.Data?.Payment?.StatusDescription || 'Failed to create subscription'
        });
      }
    } catch (error: any) {
      console.error('Subscription error:', error.response?.data || error);
      return res.status(500).json({
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Failed to create subscription'
      });
    }
  },

  async cancelSubscription(req: Request, res: Response) {
    try {
      const { subscriptionId } = req.params;

      if (!subscriptionId) {
        return res.status(400).json({
          success: false,
          error: 'Subscription ID is required'
        });
      }

      const subscription = await SubscriptionModel.findById(subscriptionId);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found'
        });
      }

      // If subscription is already cancelled, just return it
      if (subscription.status === 'CANCELLED') {
        return res.status(200).json({
          success: true,
          data: subscription
        });
      }

      // Cancel recurring payment in Sumit
      if (subscription.sumitPaymentDetails?.RecurringCustomerItemIDs?.[0]) {
        await axios.post(
          `${SUMIT_API_URL}/billing/recurring/cancel/`,
          {
            Credentials: {
              CompanyID: COMPANY_ID,
              APIKey: API_KEY
            },
            Customer: {
              ID: subscription.sumitCustomerId,
              Name: subscription.customerName,
              EmailAddress: subscription.customerEmail,
              SearchMode: 0
            },
            RecurringCustomerItemID: subscription.sumitPaymentDetails.RecurringCustomerItemIDs[0]
          }
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

      return res.status(200).json({
        success: true,
        data: subscription
      });
    } catch (error: any) {
      console.error('Subscription cancellation error:', error.response?.data || error);
      return res.status(500).json({
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Failed to cancel subscription'
      });
    }
  },

  async multivendorCharge(req: Request, res: Response) {
    try {
      const { items, singleUseToken, customerInfo, vendorId } = req.body;


      // Type check for items array
      if (!Array.isArray(items) || !items.every(item =>
        typeof item.name === 'string' &&
        typeof item.price === 'number' &&
        typeof item.quantity === 'number'
      )) {
        return res.status(400).json({
          success: false,
          error: 'Invalid items format'
        });
      }

      const typedItems: CartItem[] = items;
      // Get merchant user for API key
      const vendor = await UserModel.findById(vendorId);
      if (!vendor?.sumitApiKey) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found or missing API credentials'
        });
      }

      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/multivendorcharge/`,
        {
          SingleUseToken: singleUseToken,
          Customer: {
            Name: customerInfo.name,
            EmailAddress: customerInfo.email,
            Phone: customerInfo.phone,
            SearchMode: 0
          },
          Items: typedItems.map(item => ({
            Item: {
              Name: item.name,
              Price: item.price
            },
            Quantity: item.quantity,
            UnitPrice: item.price,
            Total: item.quantity * item.price,
            CompanyID: vendor.sumitCompanyId,
            APIKey: vendor.sumitApiKey
          })),
          VATIncluded: true,
          SendDocumentByEmail: true,
          DocumentLanguage: 'Hebrew',
          DocumentType: 'InvoiceAndReceipt (1)', // חשבונית מס קבלה - issued by vendor
          Credentials: {
            CompanyID: COMPANY_ID,
            APIKey: API_KEY
          }
        }
      );

      // Multivendor response structure: Data.Vendors[].Items contains Payment, DocumentID, etc.
      const vendors = response.data.Data?.Vendors;

      if (vendors && vendors.length > 0) {
        // Check if all vendor payments succeeded
        const allValid = vendors.every((v: any) => v.Items?.Payment?.ValidPayment);

        if (allValid) {
          // Save invoice record for each vendor
          for (const vendorData of vendors) {
            const items = vendorData.Items;
            if (items?.Payment?.ValidPayment) {
              await saveSumitInvoice({
                Payment: items.Payment,
                DocumentID: items.DocumentID,
                DocumentNumber: items.DocumentNumber,
                DocumentDownloadURL: items.DocumentDownloadURL,
                CustomerID: items.CustomerID
              }, {
                customerName: customerInfo.name,
                customerEmail: customerInfo.email,
                description: 'Multivendor Charge'
              });
            }
          }

          return res.status(200).json({
            success: true,
            data: response.data.Data
          });
        }

        // Find first failed payment for error message
        const failedVendor = vendors.find((v: any) => !v.Items?.Payment?.ValidPayment);
        return res.status(400).json({
          success: false,
          error: failedVendor?.Items?.Payment?.StatusDescription || 'Payment failed'
        });
      }

      return res.status(400).json({
        success: false,
        error: 'No vendor data in response'
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Failed to process payment'
      });
    }
  },

  /**
   * Quick Charge (סליקה מהירה) - Manual one-time charge by studio owner
   * Uses vendor's Sumit credentials and creates Green Invoice receipt
   */
  async quickCharge(req: Request, res: Response) {
    try {
      const {
        singleUseToken,
        customerInfo,
        items,
        description,
        remarks,
        vendorId
      } = req.body;

      // Validate required fields
      if (!singleUseToken || !customerInfo?.name || !customerInfo?.email) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: singleUseToken, customerInfo.name, customerInfo.email'
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one item is required'
        });
      }

      // Get vendor's Sumit credentials
      const vendor = await UserModel.findById(vendorId);
      if (!vendor?.sumitApiKey || !vendor?.sumitCompanyId) {
        return res.status(400).json({
          success: false,
          error: 'Vendor not set up for payments. Please configure Sumit credentials in settings.'
        });
      }

      // Calculate total
      const total = items.reduce((sum: number, item: { price: number; quantity: number }) =>
        sum + (item.price * item.quantity), 0);

      // Process payment using vendor's credentials
      // Sumit issues the invoice directly from vendor's account
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/charge/`,
        {
          SingleUseToken: singleUseToken,
          Customer: {
            Name: customerInfo.name,
            EmailAddress: customerInfo.email,
            Phone: customerInfo.phone || undefined,
            SearchMode: 0
          },
          Items: items.map((item: { description: string; price: number; quantity: number }) => ({
            Item: {
              Name: item.description,
              Price: item.price
            },
            Quantity: item.quantity,
            UnitPrice: item.price,
            Total: item.quantity * item.price,
            Description: item.description
          })),
          VATIncluded: true,
          SendDocumentByEmail: true,
          DocumentLanguage: 'Hebrew',
          DocumentType: 'InvoiceAndReceipt (1)', // חשבונית מס קבלה - issued by vendor
          Credentials: {
            CompanyID: vendor.sumitCompanyId,
            APIKey: vendor.sumitApiKey
          }
        }
      );

      if (!response.data?.Data?.Payment?.ValidPayment) {
        return res.status(400).json({
          success: false,
          error: response.data?.Data?.Payment?.StatusDescription || 'Payment failed'
        });
      }

      // Save Sumit invoice record to our DB
      await saveSumitInvoice(response.data.Data, {
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        description: description || 'Quick Charge',
        relatedEntity: undefined // Manual charge, no related entity
      });

      // Track payment for subscription limits
      try {
        await usageService.incrementPaymentCount(vendorId, total);
      } catch (trackingError) {
        console.error('Failed to track payment usage:', trackingError);
        // Don't fail the payment, just log the error
      }

      // NOTE: Green Invoice creation disabled - Sumit already issues חשבונית מס קבלה from vendor
      // Keeping code for potential future use if we want to switch back to Green Invoice
      /*
      let greenInvoiceUrl;
      try {
        const { createInvoice } = await import('../../handlers/invoiceHandler.js');
        
        const invoiceData = {
          type: 320, // Receipt (קבלה) - since payment already processed via Sumit
          lang: 'he' as const,
          client: {
            name: customerInfo.name,
            email: customerInfo.email,
            phone: customerInfo.phone || undefined
          },
          income: items.map((item: { description: string; price: number; quantity: number }) => ({
            description: item.description,
            quantity: item.quantity,
            price: item.price
          })),
          vatType: 'INCLUDED' as const,
          currency: 'ILS' as const,
          remarks: remarks || `Quick Charge - ${description || 'Manual payment'}`,
          payment: [{
            type: 3, // Credit card
            price: total,
            date: new Date().toISOString().split('T')[0]
          }]
        };

        const invoiceResponse = await createInvoice(invoiceData);
        greenInvoiceUrl = invoiceResponse.url?.he;
      } catch (invoiceError) {
        console.error('Failed to create Green Invoice (payment succeeded):', invoiceError);
      }
      */

      return res.status(200).json({
        success: true,
        data: {
          paymentId: response.data.Data.Payment.ID,
          amount: total,
          documentUrl: response.data.Data.Payment.DocumentURL
          // greenInvoiceUrl - disabled, using Sumit document instead
        }
      });

    } catch (error: any) {
      console.error('Quick charge error:', error.response?.data || error);
      return res.status(500).json({
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Failed to process payment'
      });
    }
  },

  async validateToken(req: Request, res: Response) {
    try {
      const { singleUseToken } = req.body;

      // Call Sumit API to validate token
      const response = await axios.post(
        `${SUMIT_API_URL}/Payment/ValidateToken`,
        {
          SingleUseToken: singleUseToken,
          Credentials: {
            CompanyID: COMPANY_ID,
            APIKey: API_KEY
          }
        }
      );

      return res.json({
        success: true,
        data: response.data.Data
      });
    } catch (error) {

      return res.status(500).json({
        success: false,
        error: 'Failed to validate token'
      });
    }
  },

  async handleWebhook(req: Request, res: Response) {
    try {
      const webhookData = req.body;

      // Log webhook data
      //   logger.info('Received Sumit webhook', { webhookData });

      // Validate webhook authenticity
      // TODO: Implement webhook signature validation

      // Process webhook based on event type
      switch (webhookData.EventType) {
        case 'payment.success':
          // Handle successful payment
          break;
        case 'payment.failed':
          // Handle failed payment
          break;
        case 'subscription.created':
          // Handle subscription creation
          break;
        case 'subscription.cancelled':
          // Handle subscription cancellation
          break;
        default:
        //   logger.warn('Unknown webhook event type', {
        //     eventType: webhookData.EventType
        //   });
      }

      return res.json({ received: true });
    } catch (error) {
      //   logger.error('Failed to handle webhook', { error });
      return res.status(500).json({ error: 'Failed to process webhook' });
    }
  },

  /**
   * Save a customer's card for later charging (used for reservation payments)
   * This creates a Sumit customer with SaveCreditCard: true
   * The card is saved under the VENDOR's Sumit account for marketplace payments
   */
  async saveCardForLaterCharge(req: Request, res: Response) {
    try {
      const { singleUseToken, customerInfo, vendorId } = req.body;

      if (!singleUseToken || !customerInfo || !vendorId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: singleUseToken, customerInfo, vendorId'
        });
      }

      // Use the payment service for consistency
      const { paymentService } = await import('../../../services/paymentService.js');

      const credentials = await paymentService.getVendorCredentials(vendorId);
      if (!credentials) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found or missing payment credentials'
        });
      }

      const result = await paymentService.saveCardForLaterCharge(
        singleUseToken,
        customerInfo,
        credentials
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || 'Failed to save payment method'
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          customerId: result.customerId,
          creditCardToken: result.creditCardToken,
          lastFourDigits: result.lastFourDigits
        }
      });
    } catch (error: any) {
      console.error('Save card error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save card'
      });
    }
  },

  /**
   * Charge a previously saved card (used when reservation is approved)
   * Uses the Sumit CustomerID to charge the saved card
   */
  async chargeSavedCard(req: Request, res: Response) {
    try {
      const { sumitCustomerId, amount, description, vendorId } = req.body;

      if (!sumitCustomerId || !amount || !vendorId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sumitCustomerId, amount, vendorId'
        });
      }

      // Use the payment service for consistency
      const { paymentService } = await import('../../../services/paymentService.js');

      const credentials = await paymentService.getVendorCredentials(vendorId);
      if (!credentials) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found or missing payment credentials'
        });
      }

      const result = await paymentService.chargeSavedCard(
        sumitCustomerId,
        amount,
        description || 'Reservation payment',
        credentials
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || 'Payment failed'
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          paymentId: result.paymentId
        }
      });
    } catch (error: any) {
      console.error('Charge saved card error:', error);
      return res.status(500).json({
        success: false,
        error: 'Payment failed'
      });
    }
  },

  /**
   * Refund a payment (used when cancelling a charged reservation)
   */
  async refundPayment(req: Request, res: Response) {
    try {
      const { sumitPaymentId, amount, vendorId } = req.body;

      if (!sumitPaymentId || !amount || !vendorId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sumitPaymentId, amount, vendorId'
        });
      }

      // Use the payment service for consistency
      const { paymentService } = await import('../../../services/paymentService.js');

      const credentials = await paymentService.getVendorCredentials(vendorId);
      if (!credentials) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found or missing payment credentials'
        });
      }

      const result = await paymentService.refundPayment(
        sumitPaymentId,
        amount,
        credentials
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || 'Refund failed'
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          refundId: result.refundId
        }
      });
    } catch (error: any) {
      console.error('Refund error:', error);
      return res.status(500).json({
        success: false,
        error: 'Refund failed'
      });
    }
  },

  /**
   * Create a subscription with a free trial period
   * Saves the card for later charging but doesn't charge immediately
   * POST /api/sumit/payments/create-subscription-trial
   */
  async createSubscriptionWithTrial(req: Request, res: Response) {
    try {
      const { singleUseToken, customerInfo, planDetails, trialDays } = req.body;

      if (!singleUseToken || !customerInfo || !planDetails) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: singleUseToken, customerInfo, planDetails'
        });
      }

      const planConfig = SUBSCRIPTION_PLANS[planDetails.planId as keyof typeof SUBSCRIPTION_PLANS];
      if (!planConfig) {
        return res.status(400).json({
          success: false,
          error: 'Invalid plan ID'
        });
      }

      // Use configured trial days or override from request
      const effectiveTrialDays = trialDays || planConfig.trialDays || 7;

      // Find any active subscription for this user
      const existingSubscription = await SubscriptionModel.findOne({
        userId: customerInfo.userId,
        status: { $in: ['ACTIVE', 'TRIAL'] }
      });

      if (existingSubscription) {
        return res.status(400).json({
          success: false,
          error: 'User already has an active subscription. Please cancel first.'
        });
      }

      // Save the card without charging (using platform credentials)
      // This creates a Sumit customer with the saved payment method
      const saveResult = await paymentService.saveCardForLaterCharge(
        singleUseToken,
        {
          name: customerInfo.customerName,
          email: customerInfo.customerEmail,
          phone: customerInfo.customerPhone || ''
        },
        { companyId: COMPANY_ID!, apiKey: API_KEY!, vendorId: '' }
      );

      if (!saveResult.success || !saveResult.customerId) {
        return res.status(400).json({
          success: false,
          error: saveResult.error || 'Failed to save payment method'
        });
      }

      // Calculate trial end date
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + effectiveTrialDays);

      // Create the subscription in TRIAL status
      const subscription = await SubscriptionModel.create({
        userId: customerInfo.userId,
        planId: planDetails.planId,
        planName: planConfig.name,
        customerName: customerInfo.customerName,
        customerEmail: customerInfo.customerEmail,
        status: 'TRIAL',
        isTrial: true,
        trialEndDate,
        trialDurationDays: effectiveTrialDays,
        startDate: new Date(),
        sumitCustomerId: saveResult.customerId,
        sumitPaymentDetails: {
          Payment: {
            CustomerID: saveResult.customerId,
            PaymentMethod: {
              CreditCard_LastDigits: saveResult.lastFourDigits,
              CreditCard_Token: saveResult.creditCardToken
            }
          }
        }
      });

      // Save card on user for future use
      if (customerInfo.userId && saveResult.customerId) {
        try {
          await UserModel.findByIdAndUpdate(customerInfo.userId, {
            sumitCustomerId: saveResult.customerId,
            savedCardLastFour: saveResult.lastFourDigits,
            savedCardBrand: 'visa',
            subscriptionStatus: 'TRIAL',
            subscriptionId: subscription._id
          });
        } catch (userUpdateError) {
          console.error('[Trial Subscription] Failed to update user:', userUpdateError);
        }
      }

      console.log('[Trial Subscription] Created trial subscription:', {
        subscriptionId: subscription._id,
        userId: customerInfo.userId,
        planId: planDetails.planId,
        trialEndDate,
        customerId: saveResult.customerId
      });

      return res.status(200).json({
        success: true,
        data: {
          subscription,
          trialEndDate,
          trialDays: effectiveTrialDays,
          savedCard: {
            lastFour: saveResult.lastFourDigits
          }
        }
      });
    } catch (error: any) {
      console.error('Create trial subscription error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to create trial subscription'
      });
    }
  },

  /**
   * Charge a trial subscription after trial ends
   * Called by cron job or webhook when trial period ends
   * POST /api/sumit/payments/charge-trial-subscription
   */
  async chargeTrialSubscription(req: Request, res: Response) {
    try {
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({
          success: false,
          error: 'Subscription ID is required'
        });
      }

      const subscription = await SubscriptionModel.findById(subscriptionId);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found'
        });
      }

      if (subscription.status !== 'TRIAL') {
        return res.status(400).json({
          success: false,
          error: `Cannot charge subscription with status: ${subscription.status}`
        });
      }

      if (!subscription.sumitCustomerId) {
        return res.status(400).json({
          success: false,
          error: 'No saved payment method for this subscription'
        });
      }

      const planConfig = SUBSCRIPTION_PLANS[subscription.planId as keyof typeof SUBSCRIPTION_PLANS];
      if (!planConfig) {
        return res.status(400).json({
          success: false,
          error: 'Invalid plan configuration'
        });
      }

      // Increment charge attempts
      subscription.trialChargeAttempts = (subscription.trialChargeAttempts || 0) + 1;

      // Create the recurring subscription in Sumit using the saved customer
      // This charges immediately and sets up recurring
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/recurring/charge/`,
        {
          Customer: {
            ID: parseInt(subscription.sumitCustomerId),
            SearchMode: 1 // Search by ID
          },
          Items: [{
            Item: {
              Name: planConfig.name,
              Duration_Months: 1
            },
            Quantity: 1,
            UnitPrice: planConfig.price,
            Description: `${planConfig.name} - After ${subscription.trialDurationDays} day trial`,
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
          customerName: subscription.customerName || '',
          customerEmail: subscription.customerEmail || '',
          description: `${planConfig.name} - First charge after trial`
        });

        console.log('[Trial Subscription] Successfully charged trial subscription:', {
          subscriptionId: subscription._id,
          paymentId: response.data.Data.Payment.ID
        });

        return res.status(200).json({
          success: true,
          data: {
            subscription,
            payment: response.data.Data
          }
        });
      } else {
        // Payment failed
        subscription.trialChargeFailedAt = new Date();

        // After 3 failed attempts, mark as TRIAL_ENDED
        if (subscription.trialChargeAttempts >= 3) {
          subscription.status = 'TRIAL_ENDED';
          await UserModel.findByIdAndUpdate(subscription.userId, {
            subscriptionStatus: 'TRIAL_ENDED'
          });
        }

        await subscription.save();

        return res.status(400).json({
          success: false,
          error: response?.data?.Data?.Payment?.StatusDescription || 'Payment failed',
          chargeAttempts: subscription.trialChargeAttempts
        });
      }
    } catch (error: any) {
      console.error('Charge trial subscription error:', error.response?.data || error);
      return res.status(500).json({
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Failed to charge trial subscription'
      });
    }
  },

  /**
   * Get subscriptions with trials ending soon (for cron job)
   * GET /api/sumit/payments/trial-subscriptions-ending
   * Query: { days: number } - subscriptions ending within X days
   */
  async getTrialSubscriptionsEnding(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 1;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const subscriptions = await SubscriptionModel.find({
        status: 'TRIAL',
        trialEndDate: { $lte: endDate }
      }).populate('userId', 'name email');

      return res.status(200).json({
        success: true,
        data: subscriptions,
        count: subscriptions.length
      });
    } catch (error: any) {
      console.error('Get trial subscriptions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get trial subscriptions'
      });
    }
  },

  /**
   * Get saved card by phone number (for non-logged-in users)
   * POST /api/sumit/payments/saved-card-by-phone
   * Body: { phone: string }
   */
  async getSavedCardByPhone(req: Request, res: Response) {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      const { paymentService } = await import('../../../services/paymentService.js');
      const result = await paymentService.getSavedPaymentMethodsByPhone(phone);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error || 'No saved card found'
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          customerId: result.customerId,
          card: {
            id: result.paymentMethod?.id,
            last4: result.paymentMethod?.lastFourDigits,
            expirationMonth: result.paymentMethod?.expirationMonth,
            expirationYear: result.paymentMethod?.expirationYear,
            brand: 'visa' // Could detect from card mask
          }
        }
      });
    } catch (error: any) {
      console.error('Get saved card by phone error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check for saved card'
      });
    }
  },

  /**
   * Create a document (invoice/receipt) via Sumit without payment
   * POST /api/sumit/payments/create-invoice
   * Uses vendor's Sumit credentials to issue the document
   * 
   * Document Types:
   *   1 = חשבונית מס (Tax Invoice)
   *   2 = חשבונית מס קבלה (Tax Invoice + Receipt) 
   *   3 = קבלה (Receipt)
   *   4 = הצעת מחיר (Quote)
   *   5 = הזמנה (Order)
   */
  async createDocument(req: Request, res: Response) {
    try {
      const {
        vendorId,
        customerInfo,
        items,
        vatIncluded = true,
        remarks
      } = req.body;

      // Validate required fields
      if (!vendorId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: vendorId'
        });
      }

      if (!customerInfo?.name || !customerInfo?.email) {
        return res.status(400).json({
          success: false,
          error: 'Missing required customer info: name, email'
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one item is required'
        });
      }

      // Get vendor's Sumit credentials
      const vendor = await UserModel.findById(vendorId);
      if (!vendor?.sumitApiKey || !vendor?.sumitCompanyId) {
        return res.status(400).json({
          success: false,
          error: 'Vendor not set up for invoicing. Please configure Sumit credentials in settings.'
        });
      }

      // Calculate total
      const total = items.reduce((sum: number, item: { price: number; quantity: number }) =>
        sum + (item.price * item.quantity), 0);

      // Build Sumit API request body
      const sumitRequest = {
        Details: {
          Type: 1, // חשבונית מס (Tax Invoice)
          Customer: {
            Name: customerInfo.name,
            EmailAddress: customerInfo.email,
            Phone: customerInfo.phone || null,
            SearchMode: 0
          },
          SendByEmail: {
            EmailAddress: customerInfo.email,
            Original: true,
            SendAsPaymentRequest: false
          },
          Language: 'he', // Hebrew
          Description: remarks || null
        },
        Items: items.map((item: { description: string; price: number; quantity: number }) => ({
          Item: {
            Name: item.description,
            SearchMode: 0
          },
          Quantity: item.quantity,
          UnitPrice: item.price,
          TotalPrice: item.quantity * item.price
        })),
        VATIncluded: vatIncluded,
        Credentials: {
          CompanyID: vendor.sumitCompanyId,
          APIKey: vendor.sumitApiKey
        }
      };

      // Create document via Sumit API
      const response = await axios.post(
        `${SUMIT_API_URL}/accounting/documents/create/`,
        sumitRequest
      );

      // Check response status - Sumit uses Status field
      const sumitData = response.data?.Data;
      const sumitStatus = response.data?.Status;

      // Status 0 = success, DocumentID present = success
      if (sumitStatus === 0 || sumitData?.DocumentID) {
        // Save document record to our DB
        try {
          await InvoiceModel.create({
            externalId: sumitData.DocumentID.toString(),
            provider: 'SUMIT',
            documentType: 'invoice', // חשבונית מס
            amount: total,
            currency: 'ILS',
            issuedDate: new Date(),
            customerName: customerInfo.name,
            customerEmail: customerInfo.email,
            documentUrl: sumitData.DocumentDownloadURL || null,
            status: 'SENT',
            rawData: {
              DocumentID: sumitData.DocumentID,
              DocumentNumber: sumitData.DocumentNumber,
              CustomerID: sumitData.CustomerID,
              DocumentDownloadURL: sumitData.DocumentDownloadURL,
              DocumentPaymentURL: sumitData.DocumentPaymentURL
            }
          });
        } catch (dbError) {
          console.error('Failed to save invoice to DB (document was created):', dbError);
        }

        return res.status(200).json({
          success: true,
          data: {
            documentId: sumitData.DocumentID,
            documentNumber: sumitData.DocumentNumber,
            customerId: sumitData.CustomerID,
            documentUrl: sumitData.DocumentDownloadURL,
            paymentUrl: sumitData.DocumentPaymentURL
          }
        });
      }

      // Handle error response
      return res.status(400).json({
        success: false,
        error: response.data?.UserErrorMessage || response.data?.TechnicalErrorDetails || 'Failed to create document'
      });

    } catch (error: any) {
      console.error('Create document error:', error.response?.data || error);
      return res.status(500).json({
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Failed to create document'
      });
    }
  }
};