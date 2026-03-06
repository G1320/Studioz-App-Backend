import axios from 'axios';
import { randomUUID } from 'crypto';
import { PaymentCanaryResultModel, type IPaymentCanaryResult } from '../models/paymentCanaryModel.js';
import { sendHtmlEmail } from '../api/handlers/emailHandler.js';

const SUMIT_API_URL = 'https://api.sumit.co.il';
const PLATFORM_COMPANY_ID = process.env.SUMIT_COMPANY_ID;
const PLATFORM_API_KEY = process.env.SUMIT_API_KEY;

const CANARY_CUSTOMER_ID = () => process.env.CANARY_SUMIT_CUSTOMER_ID;
const CANARY_ALERT_EMAIL = () => process.env.CANARY_ALERT_EMAIL || 'admin@studioz.online';
const CANARY_CHARGE_AMOUNT = 1; // 1 ILS

export const paymentCanaryService = {
  /**
   * Run a full canary payment test:
   * 1. Charge 1 ILS to the saved canary card
   * 2. Verify the charge succeeded
   * 3. Immediately refund the charge
   * 4. Log the result and alert on failure
   */
  async runCanaryTest(): Promise<IPaymentCanaryResult> {
    const testId = randomUUID();
    const customerId = CANARY_CUSTOMER_ID();

    if (!customerId) {
      const result = await PaymentCanaryResultModel.create({
        testId,
        timestamp: new Date(),
        status: 'charge_failed',
        chargeAmount: CANARY_CHARGE_AMOUNT,
        currency: 'ILS',
        chargeLatencyMs: 0,
        errorMessage: 'CANARY_SUMIT_CUSTOMER_ID not configured. Run the setup-card endpoint first.'
      });
      await this.sendCanaryAlert(result);
      return result;
    }

    if (!PLATFORM_COMPANY_ID || !PLATFORM_API_KEY) {
      const result = await PaymentCanaryResultModel.create({
        testId,
        timestamp: new Date(),
        status: 'charge_failed',
        chargeAmount: CANARY_CHARGE_AMOUNT,
        currency: 'ILS',
        chargeLatencyMs: 0,
        errorMessage: 'Platform Sumit credentials (SUMIT_COMPANY_ID / SUMIT_API_KEY) not configured.'
      });
      await this.sendCanaryAlert(result);
      return result;
    }

    // --- Step 1: Charge ---
    let sumitPaymentId: string | undefined;
    let chargeLatencyMs: number;

    const chargeStart = Date.now();
    try {
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/charge/`,
        {
          Customer: {
            ID: parseInt(customerId),
            SearchMode: 1
          },
          Items: [{
            Item: { Name: 'Payment Health Check' },
            Quantity: 1,
            UnitPrice: CANARY_CHARGE_AMOUNT,
            Total: CANARY_CHARGE_AMOUNT,
            Currency: 'ILS',
            Description: 'Automated canary test — will be refunded immediately'
          }],
          VATIncluded: true,
          SendDocumentByEmail: false,
          Credentials: {
            CompanyID: PLATFORM_COMPANY_ID,
            APIKey: PLATFORM_API_KEY
          }
        }
      );
      chargeLatencyMs = Date.now() - chargeStart;

      const payment = response.data?.Data?.Payment;
      if (!payment?.ValidPayment) {
        const result = await PaymentCanaryResultModel.create({
          testId,
          timestamp: new Date(),
          status: 'charge_failed',
          chargeAmount: CANARY_CHARGE_AMOUNT,
          currency: 'ILS',
          chargeLatencyMs,
          errorMessage: payment?.StatusDescription || response.data?.UserErrorMessage || 'Charge returned invalid payment',
          errorDetails: { responseData: response.data }
        });
        console.error(`[Payment Canary] CHARGE FAILED (${chargeLatencyMs}ms):`, result.errorMessage);
        await this.sendCanaryAlert(result);
        return result;
      }

      sumitPaymentId = payment.ID?.toString();
      console.log(`[Payment Canary] Charge OK (${chargeLatencyMs}ms) — PaymentID: ${sumitPaymentId}`);
    } catch (error: any) {
      chargeLatencyMs = Date.now() - chargeStart;
      const result = await PaymentCanaryResultModel.create({
        testId,
        timestamp: new Date(),
        status: 'charge_failed',
        chargeAmount: CANARY_CHARGE_AMOUNT,
        currency: 'ILS',
        chargeLatencyMs,
        errorMessage: error.response?.data?.UserErrorMessage || error.message || 'Charge request failed',
        errorDetails: {
          status: error.response?.status,
          data: error.response?.data
        }
      });
      console.error(`[Payment Canary] CHARGE ERROR (${chargeLatencyMs}ms):`, result.errorMessage);
      await this.sendCanaryAlert(result);
      return result;
    }

    // --- Step 2: Refund ---
    let refundLatencyMs: number;
    const refundStart = Date.now();

    try {
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/refund/`,
        {
          PaymentID: sumitPaymentId,
          Amount: CANARY_CHARGE_AMOUNT,
          Credentials: {
            CompanyID: PLATFORM_COMPANY_ID,
            APIKey: PLATFORM_API_KEY
          }
        }
      );
      refundLatencyMs = Date.now() - refundStart;

      const refundData = response.data?.Data;
      const refundId = refundData?.Refund?.ID || refundData?.ID;

      if (refundId || response.data?.Status === 0) {
        const result = await PaymentCanaryResultModel.create({
          testId,
          timestamp: new Date(),
          status: 'pass',
          chargeAmount: CANARY_CHARGE_AMOUNT,
          currency: 'ILS',
          sumitPaymentId,
          refundId: refundId?.toString(),
          chargeLatencyMs,
          refundLatencyMs
        });
        console.log(`[Payment Canary] PASS — charge ${chargeLatencyMs}ms, refund ${refundLatencyMs}ms`);
        return result;
      }

      // Refund call succeeded but returned unexpected response
      const result = await PaymentCanaryResultModel.create({
        testId,
        timestamp: new Date(),
        status: 'refund_failed',
        chargeAmount: CANARY_CHARGE_AMOUNT,
        currency: 'ILS',
        sumitPaymentId,
        chargeLatencyMs,
        refundLatencyMs,
        errorMessage: response.data?.UserErrorMessage || refundData?.StatusDescription || 'Refund returned unexpected response',
        errorDetails: { responseData: response.data }
      });
      console.error(`[Payment Canary] REFUND FAILED (${refundLatencyMs}ms):`, result.errorMessage);
      await this.sendCanaryAlert(result);
      return result;
    } catch (error: any) {
      refundLatencyMs = Date.now() - refundStart;
      const result = await PaymentCanaryResultModel.create({
        testId,
        timestamp: new Date(),
        status: 'refund_failed',
        chargeAmount: CANARY_CHARGE_AMOUNT,
        currency: 'ILS',
        sumitPaymentId,
        chargeLatencyMs,
        refundLatencyMs,
        errorMessage: error.response?.data?.UserErrorMessage || error.message || 'Refund request failed',
        errorDetails: {
          status: error.response?.status,
          data: error.response?.data
        }
      });
      console.error(`[Payment Canary] REFUND ERROR (${refundLatencyMs}ms):`, result.errorMessage);
      await this.sendCanaryAlert(result);
      return result;
    }
  },

  /**
   * Send email alert when a canary test fails
   */
  async sendCanaryAlert(result: IPaymentCanaryResult): Promise<void> {
    const alertEmail = CANARY_ALERT_EMAIL();
    const statusLabel = result.status === 'charge_failed' ? 'CHARGE FAILED' : 'REFUND FAILED';
    const timestamp = new Date(result.timestamp).toLocaleString('en-IL', { timeZone: 'Asia/Jerusalem' });

    try {
      await sendHtmlEmail({
        to: [{ email: alertEmail, name: 'StudioZ Admin' }],
        subject: `[ALERT] Payment Canary ${statusLabel}`,
        htmlContent: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
            <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h2 style="color: #dc2626; margin: 0 0 8px;">Payment Health Check Failed</h2>
              <p style="color: #991b1b; margin: 0; font-size: 14px;">${statusLabel} at ${timestamp}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 8px 0; color: #6b7280;">Test ID</td><td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${result.testId}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Amount</td><td style="padding: 8px 0;">${result.chargeAmount} ${result.currency}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Charge Latency</td><td style="padding: 8px 0;">${result.chargeLatencyMs}ms</td></tr>
              ${result.refundLatencyMs != null ? `<tr><td style="padding: 8px 0; color: #6b7280;">Refund Latency</td><td style="padding: 8px 0;">${result.refundLatencyMs}ms</td></tr>` : ''}
              ${result.sumitPaymentId ? `<tr><td style="padding: 8px 0; color: #6b7280;">Payment ID</td><td style="padding: 8px 0; font-family: monospace;">${result.sumitPaymentId}</td></tr>` : ''}
              <tr><td style="padding: 8px 0; color: #6b7280;">Error</td><td style="padding: 8px 0; color: #dc2626; font-weight: 500;">${result.errorMessage}</td></tr>
            </table>
            <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">This is an automated alert from StudioZ Payment Canary.</p>
          </div>
        `
      });
      console.log(`[Payment Canary] Alert email sent to ${alertEmail}`);
    } catch (emailError) {
      console.error('[Payment Canary] Failed to send alert email:', emailError);
    }
  },

  /**
   * One-time setup: save the admin's credit card for canary testing
   * Returns the customerId to set as CANARY_SUMIT_CUSTOMER_ID in .env
   */
  async saveCanaryCard(singleUseToken: string, customerInfo: { name: string; email: string; phone: string }): Promise<{
    success: boolean;
    customerId?: string;
    lastFourDigits?: string;
    error?: string;
  }> {
    try {
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/paymentmethods/setforcustomer/`,
        {
          SingleUseToken: singleUseToken,
          Customer: {
            Name: customerInfo.name || 'Canary Test Admin',
            EmailAddress: customerInfo.email || '',
            Phone: customerInfo.phone || '',
            SearchMode: 0
          },
          Credentials: {
            CompanyID: PLATFORM_COMPANY_ID,
            APIKey: PLATFORM_API_KEY
          }
        }
      );

      const responseData = response.data?.Data || response.data;

      if (responseData?.CustomerID) {
        return {
          success: true,
          customerId: responseData.CustomerID.toString(),
          lastFourDigits: responseData.PaymentMethod?.CreditCard_LastDigits
        };
      }

      return {
        success: false,
        error: response.data?.UserErrorMessage || 'Failed to save card'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.UserErrorMessage || error.message || 'Failed to save card'
      };
    }
  },

  /**
   * Get recent canary test results for history/audit
   */
  async getRecentResults(limit = 30): Promise<IPaymentCanaryResult[]> {
    return PaymentCanaryResultModel.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }
};
