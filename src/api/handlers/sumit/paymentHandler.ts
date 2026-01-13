// controllers/payment.controller.ts
import { Request, Response } from 'express';
import axios from 'axios';
import { UserModel } from '../../../models/userModel.js';
import SubscriptionModel from '../../../models/sumitModels/subscriptionModel.js';
import { saveSumitInvoice } from '../../../utils/sumitUtils.js';

const SUMIT_API_URL = 'https://api.sumit.co.il';
const COMPANY_ID = process.env.SUMIT_COMPANY_ID;
const API_KEY = process.env.SUMIT_API_KEY;

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
      if (response.data.Data.Payment.ValidPayment){
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
    }else {
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
              Credentials: {
                CompanyID: COMPANY_ID,
                APIKey: API_KEY
              }
            }
          );
       
          if (response.data.Data.Payment.ValidPayment) {
            // Save invoice record
            saveSumitInvoice(response.data.Data, {
                customerName: customerInfo.name,
                customerEmail: customerInfo.email,
                description: 'Multivendor Charge'
            });

            return res.status(200).json({
              success: true,
              data: response.data.Data
            });
          }
       
          return res.status(400).json({
            success: false, 
            error: response.data.Data.Payment.StatusDescription
          });
       
        } catch (error: any) {
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
  }
};