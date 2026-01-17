import express from 'express';
import {
  getMerchantStats,
  getPopularTimeSlots,
  getCancellationStats,
  getRepeatCustomerStats
} from '../handlers/merchantStatsHandler.js';
import { getMerchantDocuments, getMerchantDocument } from '../handlers/merchantDocumentsHandler.js';

const router = express.Router();

/**
 * @route   GET /api/merchant/stats
 * @desc    Get merchant statistics for dashboard
 * @query   userId - Required user ID
 * @access  Private
 */
router.get('/stats', getMerchantStats);

/**
 * @route   GET /api/merchant/analytics/time-slots
 * @desc    Get popular time slots analysis
 * @query   userId - Required user ID
 * @query   startDate - Optional start date filter
 * @query   endDate - Optional end date filter
 * @access  Private
 */
router.get('/analytics/time-slots', getPopularTimeSlots);

/**
 * @route   GET /api/merchant/analytics/cancellations
 * @desc    Get cancellation statistics
 * @query   userId - Required user ID
 * @query   startDate - Optional start date filter
 * @query   endDate - Optional end date filter
 * @access  Private
 */
router.get('/analytics/cancellations', getCancellationStats);

/**
 * @route   GET /api/merchant/analytics/repeat-customers
 * @desc    Get repeat customer statistics
 * @query   userId - Required user ID
 * @query   startDate - Optional start date filter
 * @query   endDate - Optional end date filter
 * @access  Private
 */
router.get('/analytics/repeat-customers', getRepeatCustomerStats);

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
router.get('/documents', getMerchantDocuments);

/**
 * @route   GET /api/merchant/documents/:id
 * @desc    Get a single document by ID
 * @params  id - Document ID
 * @access  Private
 */
router.get('/documents/:id', getMerchantDocument);

export default router;
