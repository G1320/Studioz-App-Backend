import express from 'express';
import couponHandler from '../handlers/couponHandler.js';
import { verifyTokenMw, verifyAdminMw } from '../../middleware/index.js';

const router = express.Router();

// Public routes (require authentication)
router.post('/validate', verifyTokenMw, couponHandler.validateCoupon);
router.post('/apply', verifyTokenMw, couponHandler.applyCoupon);

// Admin routes
router.post('/', verifyTokenMw, verifyAdminMw, couponHandler.createCoupon);
router.get('/', verifyTokenMw, verifyAdminMw, couponHandler.getAllCoupons);
router.get('/:id', verifyTokenMw, verifyAdminMw, couponHandler.getCouponById);
router.put('/:id', verifyTokenMw, verifyAdminMw, couponHandler.updateCoupon);
router.delete('/:id', verifyTokenMw, verifyAdminMw, couponHandler.deleteCoupon);
router.patch('/:id/toggle', verifyTokenMw, verifyAdminMw, couponHandler.toggleCouponStatus);

export default router;
