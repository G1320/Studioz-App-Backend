// controllers/payment.controller.ts
import { Request, Response } from 'express';
import axios from 'axios';
// import { logger } from '../services/logger.service';

const SUMIT_API_URL = 'https://api.sumit.co.il';
const COMPANY_ID = process.env.SUMIT_COMPANY_ID;
const API_KEY = process.env.SUMIT_API_KEY;

export const paymentHandler = {
  async processPayment(req: Request, res: Response) {
    try {
      const { singleUseToken, amount, description, costumerInfo } = req.body;
      console.log('singleUseToken, amount, description, costumerInfo: ', singleUseToken, amount, description, costumerInfo);

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
            Name: costumerInfo.costumerName,
            EmailAddress: costumerInfo.costumerEmail,
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
        const { singleUseToken, planDetails, costumerInfo } = req.body;
        
        const response = await axios.post(
          `${SUMIT_API_URL}/billing/recurring/charge/`,
          {
            SingleUseToken: singleUseToken,
            Customer: {
              SearchMode: 0,
              Name: costumerInfo.costumerName,
              EmailAddress: costumerInfo.costumerEmail
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
              
        if (response.data.Data.Payment.ValidPayment){
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
      } catch (error: any) {
        console.error('Subscription error:', error.response?.data || error);
        return res.status(500).json({
          success: false,
          error: error.response?.data?.UserErrorMessage || 'Failed to create subscription'
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
  }
};