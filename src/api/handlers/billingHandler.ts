import { Request, Response } from 'express';
import { platformFeeService } from '../../services/platformFeeService.js';
import { BillingCycleModel } from '../../models/billingCycleModel.js';
import { PlatformFeeModel } from '../../models/platformFeeModel.js';

export const billingHandler = {

  // ─── VENDOR ENDPOINTS ─────────────────────────────────────────

  /**
   * GET /api/merchant/billing/history
   * Returns vendor's billing cycle history (past months).
   */
  async getBillingHistory(req: Request, res: Response) {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      const cycles = await platformFeeService.getVendorBillingHistory(userId as string);

      return res.status(200).json({ success: true, data: cycles });
    } catch (error: any) {
      console.error('Get billing history error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get billing history' });
    }
  },

  /**
   * GET /api/merchant/billing/current
   * Returns pending fees for the current billing period (not yet charged).
   */
  async getCurrentFees(req: Request, res: Response) {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      const data = await platformFeeService.getVendorCurrentFees(userId as string);

      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      console.error('Get current fees error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get current fees' });
    }
  },

  /**
   * GET /api/merchant/billing/cycle/:cycleId/fees
   * Returns itemised fee list for a specific billing cycle.
   */
  async getBillingCycleFees(req: Request, res: Response) {
    try {
      const { cycleId } = req.params;
      if (!cycleId) {
        return res.status(400).json({ success: false, error: 'cycleId is required' });
      }

      const fees = await platformFeeService.getBillingCycleFees(cycleId);

      return res.status(200).json({ success: true, data: fees });
    } catch (error: any) {
      console.error('Get billing cycle fees error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get billing cycle fees' });
    }
  },

  // ─── ADMIN ENDPOINTS ──────────────────────────────────────────

  /**
   * GET /api/merchant/billing/admin/cycles
   * Returns all billing cycles with optional filters. Admin only.
   */
  async getAllBillingCycles(req: Request, res: Response) {
    try {
      const { status, period, page = '1', limit = '50' } = req.query;

      const filter: Record<string, any> = {};
      if (status) filter.status = status;
      if (period) filter.period = period;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const [cycles, total] = await Promise.all([
        BillingCycleModel.find(filter)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .populate('vendorId', 'name email')
          .lean(),
        BillingCycleModel.countDocuments(filter)
      ]);

      return res.status(200).json({
        success: true,
        data: cycles,
        pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
      });
    } catch (error: any) {
      console.error('Admin get billing cycles error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get billing cycles' });
    }
  },

  /**
   * POST /api/merchant/billing/admin/run
   * Manually trigger the monthly billing run. Admin only.
   */
  async triggerBillingRun(req: Request, res: Response) {
    try {
      const { period } = req.body;
      console.log('[Admin] Manually triggering billing run', period ? `for period ${period}` : '(previous month)');

      const result = await platformFeeService.runMonthlyBilling(period);

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Admin trigger billing error:', error);
      return res.status(500).json({ success: false, error: 'Failed to trigger billing run' });
    }
  },

  /**
   * POST /api/merchant/billing/admin/retry/:cycleId
   * Retry a specific failed billing cycle. Admin only.
   */
  async retryCycle(req: Request, res: Response) {
    try {
      const { cycleId } = req.params;
      const result = await platformFeeService.processBillingCycle(cycleId);

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Admin retry cycle error:', error);
      return res.status(500).json({ success: false, error: 'Failed to retry billing cycle' });
    }
  },

  /**
   * POST /api/merchant/billing/admin/waive/:feeId
   * Waive a specific platform fee. Admin only.
   */
  async waiveFee(req: Request, res: Response) {
    try {
      const { feeId } = req.params;
      const { reason } = req.body;

      const fee = await PlatformFeeModel.findById(feeId);
      if (!fee) {
        return res.status(404).json({ success: false, error: 'Fee not found' });
      }

      if (fee.status !== 'pending') {
        return res.status(400).json({ success: false, error: `Cannot waive fee with status: ${fee.status}` });
      }

      fee.status = 'waived';
      fee.creditedAt = new Date();
      fee.creditReason = reason || 'Waived by admin';
      await fee.save();

      return res.status(200).json({ success: true, data: fee });
    } catch (error: any) {
      console.error('Admin waive fee error:', error);
      return res.status(500).json({ success: false, error: 'Failed to waive fee' });
    }
  }
};
