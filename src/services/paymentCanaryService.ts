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
      {
        $set: {
          sumitCustomerId: params.sumitCustomerId,
          customerEmail: params.customerEmail,
          customerName: params.customerName,
          lastFourDigits: params.lastFourDigits ?? null,
          creditCardToken: params.creditCardToken ?? null,
          setupAt: new Date()
        }
      },
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
   * 1. Validate 1 ILS via multivendorcharge with AuthoriseOnly: true
   * 2. Validates the full pipeline (customer, card, vendor creds) without moving money
   * 3. No refund needed — transaction is never committed
   */
  async runCanaryTest(): Promise<IPaymentCanaryResult> {
    const testId = randomUUID();
    const canaryConfig = await this.getCanaryConfig();

    console.log('[Payment Canary] Pre-check — config from MongoDB:', {
      hasSumitCustomerId: !!canaryConfig?.sumitCustomerId,
      sumitCustomerId: canaryConfig?.sumitCustomerId || 'MISSING',
      hasCustomerEmail: !!canaryConfig?.customerEmail,
      customerEmail: canaryConfig?.customerEmail || 'MISSING',
      hasCreditCardToken: !!canaryConfig?.creditCardToken,
      hasPlatformCreds: !!PLATFORM_COMPANY_ID && !!PLATFORM_API_KEY
    });

    if (!canaryConfig?.sumitCustomerId) {
      const result = await PaymentCanaryResultModel.create({
        testId,
        timestamp: new Date(),
        status: 'charge_failed',
        chargeAmount: CANARY_CHARGE_AMOUNT,
        currency: 'ILS',
        chargeLatencyMs: 0,
        errorMessage: 'Canary customer not configured — no sumitCustomerId. Use the Setup Card button first.'
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
    console.log('[Payment Canary] Pre-check — vendor creds:', vendorCreds ? { companyId: vendorCreds.companyId } : 'NONE');

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

    // Validate via multivendorcharge — same path as real customer orders.
    // AuthoriseOnly: true = validate only, no money moves, document issued as Draft.
    // Sumit docs: "This field could be used for testing the Charge action easily."
    const chargePayload = {
      Customer: {
        ID: parseInt(canaryConfig.sumitCustomerId),
        SearchMode: 1
      },
      Items: [{
        Item: { Name: 'Payment Health Check' },
        Quantity: 1,
        UnitPrice: CANARY_CHARGE_AMOUNT,
        Total: CANARY_CHARGE_AMOUNT,
        Currency: 'ILS',
        Description: 'Automated canary — validate only',
        CompanyID: vendorCreds.companyId,
        APIKey: vendorCreds.apiKey
      }],
      VATIncluded: true,
      SendDocumentByEmail: false,
      DocumentLanguage: 'Hebrew',
      AuthoriseOnly: true,
      DraftDocument: true,
      Credentials: {
        CompanyID: PLATFORM_COMPANY_ID,
        APIKey: PLATFORM_API_KEY
      }
    };

    console.log('[Payment Canary] Sending multivendorcharge (authorize-only):', JSON.stringify(chargePayload, null, 2));

    let chargeLatencyMs: number;
    const chargeStart = Date.now();

    try {
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/multivendorcharge/`,
        chargePayload
      );
      chargeLatencyMs = Date.now() - chargeStart;

      console.log('[Payment Canary] multivendorcharge response:', JSON.stringify(response.data, null, 2));

      const vendors = response.data?.Data?.Vendors;
      const vendorResult = vendors?.[0]?.Items;
      const payment = vendorResult?.Payment;

      if (payment?.ValidPayment) {
        const result = await PaymentCanaryResultModel.create({
          testId,
          timestamp: new Date(),
          status: 'pass',
          chargeAmount: CANARY_CHARGE_AMOUNT,
          currency: 'ILS',
          sumitPaymentId: payment.ID?.toString(),
          chargeLatencyMs
        });
        console.log(`[Payment Canary] PASS — authorized in ${chargeLatencyMs}ms, PaymentID: ${payment.ID}`);
        return result;
      }

      const result = await PaymentCanaryResultModel.create({
        testId,
        timestamp: new Date(),
        status: 'charge_failed',
        chargeAmount: CANARY_CHARGE_AMOUNT,
        currency: 'ILS',
        chargeLatencyMs,
        errorMessage: payment?.StatusDescription || response.data?.UserErrorMessage || 'Authorization returned invalid payment',
        errorDetails: { responseData: response.data }
      });
      console.error(`[Payment Canary] AUTH FAILED (${chargeLatencyMs}ms):`, result.errorMessage);
      await this.sendCanaryAlert(result);
      return result;
    } catch (error: any) {
      chargeLatencyMs = Date.now() - chargeStart;
      const result = await PaymentCanaryResultModel.create({
        testId,
        timestamp: new Date(),
        status: 'charge_failed',
        chargeAmount: CANARY_CHARGE_AMOUNT,
        currency: 'ILS',
        chargeLatencyMs,
        errorMessage: error.response?.data?.UserErrorMessage || error.message || 'Multivendor authorize request failed',
        errorDetails: {
          status: error.response?.status,
          data: error.response?.data
        }
      });
      console.error(`[Payment Canary] AUTH ERROR (${chargeLatencyMs}ms):`, result.errorMessage);
      await this.sendCanaryAlert(result);
      return result;
    }
  },

  /**
   * Send email alert when a canary test fails
   */
  async sendCanaryAlert(result: IPaymentCanaryResult): Promise<void> {
    const alertEmail = CANARY_ALERT_EMAIL();
    const statusLabel = result.status === 'charge_failed' ? 'AUTH FAILED' : 'FAILED';
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
   * multivendorcharge then finds this customer by ID (SearchMode: 1).
   */
  async saveCanaryCard(singleUseToken: string, customerInfo: { name: string; email: string; phone: string }): Promise<{
    success: boolean;
    customerId?: string;
    lastFourDigits?: string;
    error?: string;
  }> {
    try {
      const customerName = customerInfo.name || 'Canary Test Admin';
      const customerEmail = customerInfo.email || 'canary-billing@studioz.online';

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

      console.log('[Payment Canary] Card saved — CustomerID:', customerId, 'LastDigits:', lastFourDigits, 'Token:', creditCardToken ? creditCardToken.substring(0, 8) + '...' : 'MISSING');

      await this.saveCanaryConfig({
        sumitCustomerId: customerId,
        customerEmail,
        customerName,
        lastFourDigits: lastFourDigits || undefined,
        creditCardToken: creditCardToken || undefined,
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
