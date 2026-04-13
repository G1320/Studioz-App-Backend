import mongoose from 'mongoose';
import axios from 'axios';
import { PlatformFeeModel } from '../models/platformFeeModel.js';
import { BillingCycleModel } from '../models/billingCycleModel.js';
import { UserModel } from '../models/userModel.js';
import { SubscriptionModel } from '../models/sumitModels/subscriptionModel.js';
import { saveSumitInvoice } from '../utils/sumitUtils.js';
import { sendPlatformFeeCharged, sendPlatformFeeFailed } from '../api/handlers/emailHandler.js';
import {
  PLATFORM_FEE_TIERS,
  calculateTieredFee,
  getNextTierNudge,
  type TierBreakdownItem,
} from '../config/platformFeeTiers.js';

const SUMIT_API_URL = 'https://api.sumit.co.il';
const PLATFORM_COMPANY_ID = process.env.SUMIT_COMPANY_ID;
const PLATFORM_API_KEY = process.env.SUMIT_API_KEY;

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_INTERVAL_DAYS = 3;

const getCurrentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getPreviousPeriod = (): string => {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
};

interface RecordFeeParams {
  vendorId: string;
  transactionAmount: number;
  transactionType: 'reservation' | 'quick_charge' | 'multivendor' | 'remote_project';
  reservationId?: string;
  studioId?: string;
  sumitPaymentId?: string;
}

export const platformFeeService = {

  /**
   * Record a platform fee after a successful payment.
   * Uses marginal tier calculation based on the vendor's current-month revenue.
   * Called from paymentService / paymentHandler after every charge.
   */
  async recordFee(params: RecordFeeParams): Promise<void> {
    try {
      const period = getCurrentPeriod();

      // Get vendor's already-recorded transaction volume this month
      const existingVolume = await PlatformFeeModel.aggregate([
        { $match: { vendorId: new mongoose.Types.ObjectId(params.vendorId), period, status: { $ne: 'credited' } } },
        { $group: { _id: null, total: { $sum: '$transactionAmount' } } }
      ]);
      const priorRevenue = existingVolume[0]?.total || 0;

      // Compute marginal fee for this transaction by calculating total fee
      // at (prior + new) and subtracting total fee at (prior).
      const feeWithNew = calculateTieredFee(priorRevenue + params.transactionAmount);
      const feePrior = calculateTieredFee(priorRevenue);
      const feeAmount = parseFloat((feeWithNew.totalFeeAmount - feePrior.totalFeeAmount).toFixed(2));
      const effectiveRate = params.transactionAmount > 0 ? feeAmount / params.transactionAmount : PLATFORM_FEE_TIERS[0].rate;

      if (feeAmount <= 0) return;

      await PlatformFeeModel.create({
        vendorId: params.vendorId,
        reservationId: params.reservationId || undefined,
        studioId: params.studioId || undefined,
        transactionType: params.transactionType,
        transactionAmount: params.transactionAmount,
        feePercentage: parseFloat(effectiveRate.toFixed(4)),
        feeAmount,
        status: 'pending',
        sumitPaymentId: params.sumitPaymentId || undefined,
        period
      });

      console.log(`[PlatformFee] Recorded fee: ${feeAmount} ILS (effective ${(effectiveRate * 100).toFixed(1)}% of ${params.transactionAmount}) for vendor ${params.vendorId}`);
    } catch (error) {
      // Never fail a payment because fee recording failed
      console.error('[PlatformFee] Failed to record fee:', error);
    }
  },

  /**
   * Credit (reverse) a fee when a reservation is refunded.
   */
  async creditFee(transactionId: string, reason?: string): Promise<void> {
    try {
      // Look up by reservationId first, then fall back to sumitPaymentId
      const fee = await PlatformFeeModel.findOne({
        $or: [
          { reservationId: transactionId },
          { sumitPaymentId: transactionId },
        ],
        status: { $in: ['pending', 'billed'] }
      });

      if (!fee) return;

      fee.status = 'credited';
      fee.creditedAt = new Date();
      fee.creditReason = reason || 'Transaction refunded';
      await fee.save();

      console.log(`[PlatformFee] Credited fee ${fee._id} (${fee.feeAmount} ILS) for transaction ${transactionId}`);
    } catch (error) {
      console.error('[PlatformFee] Failed to credit fee:', error);
    }
  },

  // ─── BILLING CYCLE LOGIC ──────────────────────────────────────

  /**
   * Generate billing cycles for the previous month.
   * Groups all pending fees by vendor and creates one BillingCycle per vendor.
   */
  async generateBillingCycles(period?: string): Promise<{ created: number; skipped: number }> {
    const targetPeriod = period || getPreviousPeriod();
    console.log(`[PlatformFee] Generating billing cycles for period: ${targetPeriod}`);

    // Aggregate pending fees by vendor for the target period
    const vendorFees = await PlatformFeeModel.aggregate([
      {
        $match: {
          period: targetPeriod,
          status: 'pending'
        }
      },
      {
        $group: {
          _id: '$vendorId',
          totalFeeAmount: { $sum: '$feeAmount' },
          totalTransactionAmount: { $sum: '$transactionAmount' },
          feeCount: { $sum: 1 },
          feeIds: { $push: '$_id' }
        }
      }
    ]);

    let created = 0;
    let skipped = 0;

    for (const vendorAgg of vendorFees) {
      const vendorId = vendorAgg._id;

      // Skip if a billing cycle already exists for this vendor+period
      const existing = await BillingCycleModel.findOne({ vendorId, period: targetPeriod });
      if (existing) {
        skipped++;
        continue;
      }

      try {
        const sumitCustomerId = await this.getVendorSumitCustomerId(vendorId.toString());

        // Use tiered calculation for the entire month's volume
        const tierResult = calculateTieredFee(vendorAgg.totalTransactionAmount);

        const cycle = await BillingCycleModel.create({
          vendorId,
          period: targetPeriod,
          totalTransactionAmount: vendorAgg.totalTransactionAmount,
          totalFeeAmount: tierResult.totalFeeAmount,
          feeCount: vendorAgg.feeCount,
          feePercentage: tierResult.effectiveRate,
          feeModel: 'tiered',
          tierBreakdown: tierResult.breakdown,
          status: 'pending',
          sumitCustomerId: sumitCustomerId || undefined
        });

        await PlatformFeeModel.updateMany(
          { _id: { $in: vendorAgg.feeIds } },
          { $set: { billingCycleId: cycle._id, status: 'billed' } }
        );

        created++;
      } catch (err: any) {
        // E11000 = duplicate key — another process created this cycle concurrently
        if (err?.code === 11000) {
          skipped++;
          continue;
        }
        console.error(`[PlatformFee] Failed to create billing cycle for vendor ${vendorId}:`, err);
      }
    }

    console.log(`[PlatformFee] Billing cycles: ${created} created, ${skipped} skipped (already exist)`);
    return { created, skipped };
  },

  /**
   * Get vendor's Sumit customer ID from their subscription or user record.
   */
  async getVendorSumitCustomerId(vendorId: string): Promise<string | null> {
    const user = await UserModel.findById(vendorId);
    if (user?.sumitCustomerId) return user.sumitCustomerId;

    // Fallback: check active subscription
    const subscription = await SubscriptionModel.findOne({
      userId: vendorId,
      status: { $in: ['ACTIVE', 'TRIAL'] }
    });
    return subscription?.sumitCustomerId || null;
  },

  /**
   * Process a single billing cycle: charge the vendor via Sumit.
   */
  async processBillingCycle(cycleId: string): Promise<{ success: boolean; error?: string }> {
    const cycle = await BillingCycleModel.findById(cycleId);
    if (!cycle) return { success: false, error: 'Billing cycle not found' };

    if (cycle.status === 'paid') return { success: true };

    if (!cycle.sumitCustomerId) {
      // Try to find it now (might have been missing during generation)
      const customerId = await this.getVendorSumitCustomerId(cycle.vendorId.toString());
      if (!customerId) {
        cycle.status = 'failed';
        cycle.failureReason = 'No payment method on file';
        await cycle.save();
        return { success: false, error: 'No payment method on file' };
      }
      cycle.sumitCustomerId = customerId;
    }

    cycle.status = 'processing';
    await cycle.save();

    try {
      const vendor = await UserModel.findById(cycle.vendorId);
      const vendorName = vendor?.name || 'Vendor';
      const periodLabel = this.formatPeriodLabel(cycle.period);

      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/charge/`,
        {
          Customer: {
            ID: parseInt(cycle.sumitCustomerId),
            SearchMode: 1
          },
          Items: [{
            Item: {
              Name: `Studioz Platform Fee - ${periodLabel}`
            },
            Quantity: 1,
            UnitPrice: cycle.totalFeeAmount,
            Total: cycle.totalFeeAmount,
            Description: `Platform service fee (effective ${(cycle.feePercentage * 100).toFixed(1)}%) on ${cycle.feeCount} transactions totalling ${cycle.totalTransactionAmount} ILS`
          }],
          VATIncluded: true,
          SendDocumentByEmail: true,
          DocumentLanguage: 'Hebrew',
          Credentials: {
            CompanyID: PLATFORM_COMPANY_ID,
            APIKey: PLATFORM_API_KEY
          }
        }
      );

      const paymentData = response.data?.Data;

      if (paymentData?.Payment?.ValidPayment) {
        cycle.status = 'paid';
        cycle.sumitPaymentId = paymentData.Payment.ID;
        cycle.chargedAt = new Date();
        cycle.invoiceDocumentId = paymentData.DocumentID?.toString();
        cycle.invoiceDocumentUrl = paymentData.DocumentDownloadURL;
        cycle.failureReason = undefined;
        await cycle.save();

        // Mark all associated fees as paid
        await PlatformFeeModel.updateMany(
          { billingCycleId: cycle._id },
          { $set: { status: 'paid' } }
        );

        // Save invoice record
        saveSumitInvoice(paymentData, {
          customerName: vendorName,
          customerEmail: vendor?.email,
          description: `Platform Fee - ${periodLabel}`,
          relatedEntity: { type: 'PAYOUT', id: cycle._id }
        });

        console.log(`[PlatformFee] Charged vendor ${cycle.vendorId}: ${cycle.totalFeeAmount} ILS for ${cycle.period}`);

        // Send success email
        if (vendor?.email) {
          sendPlatformFeeCharged(vendor.email, {
            vendorName: vendorName,
            period: periodLabel,
            totalFeeAmount: cycle.totalFeeAmount,
            totalTransactionAmount: cycle.totalTransactionAmount,
            feeCount: cycle.feeCount,
            feePercentage: cycle.feePercentage,
            invoiceUrl: paymentData.DocumentDownloadURL
          }).catch(err => console.error('[PlatformFee] Failed to send success email:', err));
        }

        return { success: true };
      }

      // Payment failed
      const statusDesc = paymentData?.Payment?.StatusDescription || 'Payment failed';
      return this.handleChargeFailure(cycle, statusDesc);
    } catch (error: any) {
      const errorMsg = error.response?.data?.UserErrorMessage || error.message || 'Charge request failed';
      return this.handleChargeFailure(cycle, errorMsg);
    }
  },

  async handleChargeFailure(cycle: any, reason: string): Promise<{ success: false; error: string }> {
    cycle.retryCount = (cycle.retryCount || 0) + 1;

    if (cycle.retryCount >= MAX_RETRY_ATTEMPTS) {
      cycle.status = 'failed';
      cycle.failureReason = `${reason} (exhausted ${MAX_RETRY_ATTEMPTS} retries)`;
      console.error(`[PlatformFee] FINAL FAILURE for vendor ${cycle.vendorId}, period ${cycle.period}: ${reason}`);
    } else {
      cycle.status = 'pending';
      cycle.failureReason = reason;
      const nextRetry = new Date();
      nextRetry.setDate(nextRetry.getDate() + RETRY_INTERVAL_DAYS);
      cycle.nextRetryAt = nextRetry;
      console.warn(`[PlatformFee] Charge failed for vendor ${cycle.vendorId}, retry ${cycle.retryCount}/${MAX_RETRY_ATTEMPTS} scheduled for ${nextRetry.toISOString()}`);
    }

    await cycle.save();

    // Only email on first failure and final failure (not every retry in between)
    const isFirstFailure = cycle.retryCount === 1;
    const isFinalFailure = cycle.retryCount >= MAX_RETRY_ATTEMPTS;
    if (isFirstFailure || isFinalFailure) {
      const vendor = await UserModel.findById(cycle.vendorId);
      if (vendor?.email) {
        const periodLabel = this.formatPeriodLabel(cycle.period);
        sendPlatformFeeFailed(vendor.email, {
          vendorName: vendor.name || 'Vendor',
          period: periodLabel,
          totalFeeAmount: cycle.totalFeeAmount,
          failureReason: reason,
          retryCount: cycle.retryCount,
          maxRetries: MAX_RETRY_ATTEMPTS
        }).catch(err => console.error('[PlatformFee] Failed to send failure email:', err));
      }
    }

    return { success: false, error: reason };
  },

  /**
   * Main entry point for the monthly scheduler.
   * 1. Generate billing cycles for last month
   * 2. Process all pending cycles
   */
  async runMonthlyBilling(period?: string): Promise<{
    generated: { created: number; skipped: number };
    processed: { success: number; failed: number };
  }> {
    console.log(`[PlatformFee] ═══ Starting monthly billing run${period ? ` for ${period}` : ''} ═══`);

    const generated = await this.generateBillingCycles(period);

    const pendingCycles = await BillingCycleModel.find({ status: 'pending' });
    let success = 0;
    let failed = 0;

    for (const cycle of pendingCycles) {
      // Respect nextRetryAt for retried cycles
      if (cycle.nextRetryAt && cycle.nextRetryAt > new Date()) continue;

      const result = await this.processBillingCycle(cycle._id.toString());
      if (result.success) success++;
      else failed++;
    }

    console.log(`[PlatformFee] ═══ Monthly billing complete: ${success} paid, ${failed} failed ═══`);
    return { generated, processed: { success, failed } };
  },

  /**
   * Retry failed billing cycles whose retry date has passed.
   * Run daily by the scheduler.
   */
  async retryFailedCycles(): Promise<{ retried: number; succeeded: number }> {
    const now = new Date();
    const cyclesToRetry = await BillingCycleModel.find({
      status: 'pending',
      retryCount: { $gt: 0, $lt: MAX_RETRY_ATTEMPTS },
      nextRetryAt: { $lte: now }
    });

    if (cyclesToRetry.length === 0) return { retried: 0, succeeded: 0 };

    console.log(`[PlatformFee] Retrying ${cyclesToRetry.length} failed billing cycles`);

    let succeeded = 0;
    for (const cycle of cyclesToRetry) {
      const result = await this.processBillingCycle(cycle._id.toString());
      if (result.success) succeeded++;
    }

    return { retried: cyclesToRetry.length, succeeded };
  },

  // ─── QUERY HELPERS (for API / dashboard) ──────────────────────

  /**
   * Get vendor's billing history (all billing cycles).
   */
  async getVendorBillingHistory(vendorId: string, limit = 12) {
    return BillingCycleModel.find({ vendorId })
      .sort({ period: -1 })
      .limit(limit)
      .lean();
  },

  /**
   * Get vendor's pending (not yet billed) fees for the current period.
   * Includes tiered calculation breakdown and next-tier nudge.
   */
  async getVendorCurrentFees(vendorId: string) {
    const period = getCurrentPeriod();
    const fees = await PlatformFeeModel.find({
      vendorId,
      period,
      status: 'pending'
    }).sort({ createdAt: -1 }).lean();

    const totalTransactionAmount = fees.reduce((sum, f) => sum + f.transactionAmount, 0);
    const count = fees.length;

    // Compute tiered fee for the full month volume
    const tierResult = calculateTieredFee(totalTransactionAmount);
    const nextTier = getNextTierNudge(totalTransactionAmount);

    return {
      period,
      feePercentage: tierResult.effectiveRate,
      fees,
      totalFeeAmount: tierResult.totalFeeAmount,
      totalTransactionAmount,
      count,
      feeTier: {
        tierIndex: tierResult.tierIndex,
        tierLabel: tierResult.tierLabel,
        effectiveRate: tierResult.effectiveRate,
        breakdown: tierResult.breakdown,
      },
      nextTier: nextTier || undefined,
      tiers: PLATFORM_FEE_TIERS,
    };
  },

  /**
   * Get detailed fees for a specific billing cycle.
   */
  async getBillingCycleFees(cycleId: string) {
    return PlatformFeeModel.find({ billingCycleId: cycleId })
      .sort({ createdAt: -1 })
      .populate('reservationId', 'bookingDate totalPrice itemName customerName')
      .lean();
  },

  formatPeriodLabel(period: string): string {
    const [year, month] = period.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month) - 1]} ${year}`;
  }
};

export default platformFeeService;
