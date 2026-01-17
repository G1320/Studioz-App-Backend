import express from 'express';
import studioCouponHandler from '../handlers/studioCouponHandler.js';
import { verifyTokenMw } from '../../middleware/index.js';

const router = express.Router();

// All routes require authentication
// Studio ownership is verified in the handler

// Customer routes (for booking flow)
router.post('/validate', verifyTokenMw, studioCouponHandler.validateStudioCoupon);
router.post('/apply', verifyTokenMw, studioCouponHandler.applyStudioCoupon);

// Studio owner routes - CRUD operations
router.post('/', verifyTokenMw, studioCouponHandler.createStudioCoupon);
router.get('/studio/:studioId', verifyTokenMw, studioCouponHandler.getStudioCoupons);
router.get('/:id', verifyTokenMw, studioCouponHandler.getStudioCouponById);
router.get('/:id/stats', verifyTokenMw, studioCouponHandler.getStudioCouponStats);
router.put('/:id', verifyTokenMw, studioCouponHandler.updateStudioCoupon);
router.delete('/:id', verifyTokenMw, studioCouponHandler.deleteStudioCoupon);
router.patch('/:id/toggle', verifyTokenMw, studioCouponHandler.toggleStudioCouponStatus);

export default router;
