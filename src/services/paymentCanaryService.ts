import axios from 'axios';
import { randomUUID } from 'crypto';
import { PaymentCanaryResultModel, PaymentCanaryConfigModel, type IPaymentCanaryResult } from '../models/paymentCanaryModel.js';
import { sendHtmlEmail } from '../api/handlers/emailHandler.js';
import { UserModel } from '../models/userModel.js';

const SUMIT_API_URL = 'https://api.sumit.co.il';
const PLATFORM_COMPANY_ID = process.env.SUMIT_COMPANY_ID;
const PLATFORM_API_KEY = process.env.SUMIT_API_KEY;

const CANARY_VENDOR_ID = () => process.env.CANARY_VENDOR_ID;
const CANARY_ALERT_EMAIL = () => process.env.CANARY_ALERT_EMAIL || 'admin@studioz.online';
const CANARY_CHARGE_AMOUNT = 1; // 1 ILS

export const paymentCanaryService = {
  /**
   * Resolve the canary customer ID: env var takes priority, then MongoDB.
   */
  async getCanaryCustomerId(): Promise<string | null> {
    const envId = process.env.CANARY_SUMIT_CUSTOMER_ID;
    if (envId) return envId;

    const config = await PaymentCanaryConfigModel.findOne({ key: 'canary' }).lean();
    return config?.sumitCustomerId || null;
  },

  /**
   * Persist canary config to MongoDB so it survives process restarts.
   */
  async saveCanaryConfig(params: {
    sumitCustomerId: string;
    customerEmail: string;
    customerName: string;
    lastFourDigits?: string;
    creditCardToken?: string;
  }): Promise<void> {
    await PaymentCanaryConfigModel.findOneAndUpdate(
      { key: 'canary' },
      { ...params, setupAt: new Date() },
      { upsert: true }
    );
    process.env.CANARY_SUMIT_CUSTOMER_ID = params.sumitCustomerId;
  },

  /**
   * Get the full canary config (email, name, etc.) from MongoDB.
   */
  async getCanaryConfig() {
    return PaymentCanaryConfigModel.findOne({ key: 'canary' }).lean();
  },

  /**
   * Look up the canary vendor's Sumit credentials.
   * Falls back to finding any vendor with Sumit credentials if CANARY_VENDOR_ID is not set.
   */
  async getCanaryVendorCredentials(): Promise<{ companyId: string; apiKey: string } | null> {
    const vendorId = CANARY_VENDOR_ID();

    if (vendorId) {
      const vendor = await UserModel.findById(vendorId).select('sumitCompanyId sumitApiKey').lean();
      if (vendor?.sumitCompanyId && vendor?.sumitApiKey) {
        return { companyId: vendor.sumitCompanyId.toString(), apiKey: vendor.sumitApiKey };
      }
      return null;
    }

    const vendor = await UserModel.findOne({
      sumitCompanyId: { $exists: true, $ne: '' },
      sumitApiKey: { $exists: true, $ne: '' }
    }).select('sumitCompanyId sumitApiKey').lean();

    if (vendor?.sumitCompanyId && vendor?.sumitApiKey) {
      return { companyId: vendor.sumitCompanyId.toString(), apiKey: vendor.sumitApiKey };
    }

    return null;
  },

  /**
   * Run a canary payment test via multivendorcharge (same path as real orders):
   * 1. Charge 1 ILS via multivendorcharge with vendor credentials
   * 2. Verify the charge succeeded
   * 3. Immediately refund the charge via vendor credentials
   * 4. Log the result and alert on failure
   */
  async runCanaryTest(): Promise<IPaymentCanaryResult> {
    const testId = randomUUID();
    const canaryConfig = await this.getCanaryConfig();

    if (!canaryConfig?.sumitCustomerId || !canaryConfig?.customerEmail) {
      const result = await PaymentCanaryResultModel.create({
        testId,
        timestamp: new Date(),
        status: 'charge_failed',
        chargeAmount: CANARY_CHARGE_AMOUNT,
        currency: 'ILS',
        chargeLatencyMs: 0,
        errorMessage: 'Canary customer not configured. Use the Setup Card button first.'
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

    const vendorCreds = await this.getCanaryVendorCredentials();
    if (!vendorCreds) {
      const result = await PaymentCanaryResultModel.create({
        testId,
        timestamp: new Date(),
        status: 'charge_failed',
        chargeAmount: CANARY_CHARGE_AMOUNT,
        currency: 'ILS',
        chargeLatencyMs: 0,
        errorMessage: 'No vendor with Sumit credentials found. Set CANARY_VENDOR_ID or onboard a vendor first.'
      });
      await this.sendCanaryAlert(result);
      return result;
    }

    // --- Step 1: Charge via multivendorcharge (same path as real customer orders) ---
    // Use SearchMode: 0 (Automatic) with the customer's email + explicit PaymentMethod
    // with the saved CreditCard_Token, because multiple customers may share the same
    // email from prior setup attempts.
    let sumitPaymentId: string | undefined;
    let chargeLatencyMs: number;

    console.log('[Payment Canary] Running test with:', {
      customerEmail: canaryConfig.customerEmail,
      customerName: canaryConfig.customerName,
      customerId: canaryConfig.sumitCustomerId,
      creditCardToken: canaryConfig.creditCardToken ? '***' : 'MISSING',
      vendorCompanyId: vendorCreds.companyId,
      platformCompanyId: PLATFORM_COMPANY_ID
    });

    const chargePayload: Record<string, any> = {
      Customer: {
        Name: canaryConfig.customerName,
        EmailAddress: canaryConfig.customerEmail,
        SearchMode: 0
      },
      Items: [{
        Item: { Name: 'Payment Health Check' },
        Quantity: 1,
        UnitPrice: CANARY_CHARGE_AMOUNT,
        Total: CANARY_CHARGE_AMOUNT,
        Currency: 'ILS',
        Description: 'Automated canary test — will be refunded immediately',
        CompanyID: vendorCreds.companyId,
        APIKey: vendorCreds.apiKey
      }],
      VATIncluded: true,
      SendDocumentByEmail: false,
      DocumentLanguage: 'Hebrew',
      Credentials: {
        CompanyID: PLATFORM_COMPANY_ID,
        APIKey: PLATFORM_API_KEY
      }
    };

    if (canaryConfig.creditCardToken) {
      chargePayload.PaymentMethod = {
        CreditCard_Token: canaryConfig.creditCardToken,
        Type: 1
      };
    }

    const chargeStart = Date.now();
    try {
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/multivendorcharge/`,
        chargePayload
      );
      chargeLatencyMs = Date.now() - chargeStart;

      console.log('[Payment Canary] multivendorcharge full response:', JSON.stringify(response.data, null, 2));

      const vendors = response.data?.Data?.Vendors;
      const vendorResult = vendors?.[0]?.Items;
      const payment = vendorResult?.Payment;

      if (!payment?.ValidPayment) {
        const result = await PaymentCanaryResultModel.create({
          testId,
          timestamp: new Date(),
          status: 'charge_failed',
          chargeAmount: CANARY_CHARGE_AMOUNT,
          currency: 'ILS',
          chargeLatencyMs,
          errorMessage: payment?.StatusDescription || response.data?.UserErrorMessage || 'Multivendor charge returned invalid payment',
          errorDetails: { responseData: response.data }
        });
        console.error(`[Payment Canary] CHARGE FAILED (${chargeLatencyMs}ms):`, result.errorMessage);
        await this.sendCanaryAlert(result);
        return result;
      }

      sumitPaymentId = payment.ID?.toString();
      console.log(`[Payment Canary] Charge OK via multivendorcharge (${chargeLatencyMs}ms) — PaymentID: ${sumitPaymentId}`);
    } catch (error: any) {
      chargeLatencyMs = Date.now() - chargeStart;
      const result = await PaymentCanaryResultModel.create({
        testId,
        timestamp: new Date(),
        status: 'charge_failed',
        chargeAmount: CANARY_CHARGE_AMOUNT,
        currency: 'ILS',
        chargeLatencyMs,
        errorMessage: error.response?.data?.UserErrorMessage || error.message || 'Multivendor charge request failed',
        errorDetails: {
          status: error.response?.status,
          data: error.response?.data
        }
      });
      console.error(`[Payment Canary] CHARGE ERROR (${chargeLatencyMs}ms):`, result.errorMessage);
      await this.sendCanaryAlert(result);
      return result;
    }

    // --- Step 2: Refund via vendor credentials (same as real refund flow) ---
    let refundLatencyMs: number;
    const refundStart = Date.now();

    try {
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/refund/`,
        {
          PaymentID: sumitPaymentId,
          Amount: CANARY_CHARGE_AMOUNT,
          Credentials: {
            CompanyID: vendorCreds.companyId,
            APIKey: vendorCreds.apiKey
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
   * One-time setup: save the admin's credit card for canary testing.
   *
   * Uses the exact same flow as real customers in paymentService.saveCardForLaterCharge:
   * 1. Call setforcustomer with SearchMode: 0 (Automatic) — Sumit creates/finds the
   *    customer and saves the card in one step.
   * 2. Persist customerId + email to MongoDB.
   *
   * multivendorcharge then finds this customer by email (SearchMode: 0).
   */
  async saveCanaryCard(singleUseToken: string, customerInfo: { name: string; email: string; phone: string }): Promise<{
    success: boolean;
    customerId?: string;
    lastFourDigits?: string;
    error?: string;
  }> {
    try {
      const customerName = customerInfo.name || 'Canary Test Admin';
      const customerEmail = customerInfo.email || 'canary@studioz.online';

      console.log('[Payment Canary] saveCanaryCard — saving card via setforcustomer (SearchMode: 0):', {
        customerName,
        customerEmail,
        platformCompanyId: PLATFORM_COMPANY_ID
      });

      // Same approach as paymentService.saveCardForLaterCharge:
      // setforcustomer with SearchMode: 0 creates/finds the customer and saves the card.
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/paymentmethods/setforcustomer/`,
        {
          SingleUseToken: singleUseToken,
          Customer: {
            Name: customerName,
            EmailAddress: customerEmail,
            Phone: customerInfo.phone || '',
            SearchMode: 0
          },
          Credentials: {
            CompanyID: PLATFORM_COMPANY_ID,
            APIKey: PLATFORM_API_KEY
          }
        }
      );

      console.log('[Payment Canary] setforcustomer response:', JSON.stringify(response.data, null, 2));

      const responseData = response.data?.Data || response.data;

      if (!responseData?.CustomerID) {
        return {
          success: false,
          error: response.data?.UserErrorMessage || 'Failed to save card — no CustomerID returned'
        };
      }

      const customerId = responseData.CustomerID.toString();
      const lastFourDigits = responseData.PaymentMethod?.CreditCard_LastDigits;
      const creditCardToken = responseData.PaymentMethod?.CreditCard_Token;

      console.log('[Payment Canary] Card saved — CustomerID:', customerId, 'LastDigits:', lastFourDigits);

      await this.saveCanaryConfig({
        sumitCustomerId: customerId,
        customerEmail: customerEmail,
        customerName: customerName,
        lastFourDigits,
        creditCardToken,
      });

      return {
        success: true,
        customerId,
        lastFourDigits
      };
    } catch (error: any) {
      console.error('[Payment Canary] saveCanaryCard error:', error.response?.data || error.message);
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
