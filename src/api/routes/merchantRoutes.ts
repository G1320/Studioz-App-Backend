import express from 'express';
import {
  getMerchantStats,
  getPopularTimeSlots,
  getCancellationStats,
  getRepeatCustomerStats,
  getStudioAnalytics,
  getCustomerAnalytics,
  getCustomerDetail,
  getProjections,
  getRevenueBreakdown
} from '../handlers/merchantStatsHandler.js';
import { getMerchantDocuments, getMerchantDocument } from '../handlers/merchantDocumentsHandler.js';
import { billingHandler } from '../handlers/billingHandler.js';
import { verifyTokenMw, verifyAdminMw } from '../../middleware/index.js';

const router = express.Router();

// TODO: All merchant routes trust userId from query params. Add ownership check
// (compare req.query.userId against the authenticated user from the JWT token)
// to prevent cross-vendor data access. Applies to stats, documents, AND billing.

/**
 * @route   GET /api/merchant/stats
 * @desc    Get merchant statistics for dashboard
 * @query   userId - Required user ID
 * @access  Private
 */
router.get('/stats', verifyTokenMw, getMerchantStats);

/**
 * @route   GET /api/merchant/analytics/time-slots
 * @desc    Get popular time slots analysis
 * @query   userId - Required user ID
 * @query   startDate - Optional start date filter
 * @query   endDate - Optional end date filter
 * @access  Private - Requires 'analytics' feature (Pro tier)
 */
router.get('/analytics/time-slots', verifyTokenMw, getPopularTimeSlots);

/**
 * @route   GET /api/merchant/analytics/cancellations
 * @desc    Get cancellation statistics
 * @query   userId - Required user ID
 * @query   startDate - Optional start date filter
 * @query   endDate - Optional end date filter
 * @access  Private - Requires 'analytics' feature (Pro tier)
 */
router.get('/analytics/cancellations', verifyTokenMw, getCancellationStats);

/**
 * @route   GET /api/merchant/analytics/repeat-customers
 * @desc    Get repeat customer statistics
 * @query   userId - Required user ID
 * @query   startDate - Optional start date filter
 * @query   endDate - Optional end date filter
 * @access  Private - Requires 'analytics' feature (Pro tier)
 */
router.get('/analytics/repeat-customers', verifyTokenMw, getRepeatCustomerStats);

router.get('/analytics/studios', verifyTokenMw, getStudioAnalytics);
router.get('/analytics/customers', verifyTokenMw, getCustomerAnalytics);
router.get('/analytics/customers/:customerId', verifyTokenMw, getCustomerDetail);
router.get('/analytics/projections', verifyTokenMw, getProjections);
router.get('/analytics/revenue-breakdown', verifyTokenMw, getRevenueBreakdown);

/**
 * @route   GET /api/merchant/documents
 * @desc    Get merchant documents (invoices, receipts, etc.)
 * @query   userId - Required user ID
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 50)
 * @query   status - Filter by status (paid, pending, overdue, draft)
 * @query   studioId - Filter by studio ID
 * @query   search - Search by document number or customer name
 * @query   startDate - Filter by start date
 * @query   endDate - Filter by end date
 * @access  Private
 */
router.get('/documents', verifyTokenMw, getMerchantDocuments);

/**
 * @route   GET /api/merchant/documents/:id
 * @desc    Get a single document by ID
 * @params  id - Document ID
 * @access  Private
 */
router.get('/documents/:id', verifyTokenMw, getMerchantDocument);

/**
 * @route   GET /api/merchant/billing/history
 * @desc    Get vendor's platform fee billing history (monthly cycles)
 * @query   userId - Required user ID
 * @access  Private
 */
router.get('/billing/history', verifyTokenMw, billingHandler.getBillingHistory);

/**
 * @route   GET /api/merchant/billing/current
 * @desc    Get vendor's pending platform fees for the current period
 * @query   userId - Required user ID
 * @access  Private
 */
router.get('/billing/current', verifyTokenMw, billingHandler.getCurrentFees);

/**
 * @route   GET /api/merchant/billing/cycle/:cycleId/fees
 * @desc    Get itemised fees for a specific billing cycle
 * @params  cycleId - Billing cycle ID
 * @access  Private
 */
router.get('/billing/cycle/:cycleId/fees', verifyTokenMw, billingHandler.getBillingCycleFees);

// ─── Admin billing management ────────────────────────────────
router.get('/billing/admin/cycles', verifyTokenMw, verifyAdminMw, billingHandler.getAllBillingCycles);
router.post('/billing/admin/run', verifyTokenMw, verifyAdminMw, billingHandler.triggerBillingRun);
router.post('/billing/admin/retry/:cycleId', verifyTokenMw, verifyAdminMw, billingHandler.retryCycle);
router.post('/billing/admin/waive/:feeId', verifyTokenMw, verifyAdminMw, billingHandler.waiveFee);

export default router;
