import { Request } from 'express';
import { CouponModel, ICoupon } from '../../models/couponModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';

/**
 * Validate a coupon code
 * POST /api/coupons/validate
 */
const validateCoupon = handleRequest(async (req: Request) => {
  const { code, planId, amount } = req.body;

  if (!code) {
    throw new ExpressError('Coupon code is required', 400);
  }

  const coupon = await CouponModel.findOne({ 
    code: code.toUpperCase().trim(),
    isActive: true 
  });

  if (!coupon) {
    throw new ExpressError('Invalid coupon code', 404);
  }

  // Check if coupon is within valid date range
  const now = new Date();
  if (now < coupon.validFrom) {
    throw new ExpressError('This coupon is not yet valid', 400);
  }
  if (now > coupon.validUntil) {
    throw new ExpressError('This coupon has expired', 400);
  }

  // Check usage limit
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    throw new ExpressError('This coupon has reached its usage limit', 400);
  }

  // Check minimum purchase amount
  if (coupon.minPurchaseAmount && amount && amount < coupon.minPurchaseAmount) {
    throw new ExpressError(`Minimum purchase amount of ₪${coupon.minPurchaseAmount} required`, 400);
  }

  // Check if coupon is applicable to the plan
  if (planId && !coupon.applicablePlans.includes('all') && !coupon.applicablePlans.includes(planId)) {
    throw new ExpressError('This coupon is not applicable to the selected plan', 400);
  }

  // Calculate discount
  let discountAmount = 0;
  if (amount) {
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((amount * coupon.discountValue) / 100);
    } else {
      discountAmount = Math.min(coupon.discountValue, amount); // Don't discount more than the amount
    }
  }

  return {
    valid: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount
    }
  };
});

/**
 * Apply a coupon (increment usage count)
 * POST /api/coupons/apply
 */
const applyCoupon = handleRequest(async (req: Request) => {
  const { code } = req.body;

  if (!code) {
    throw new ExpressError('Coupon code is required', 400);
  }

  const coupon = await CouponModel.findOneAndUpdate(
    { 
      code: code.toUpperCase().trim(),
      isActive: true,
      $or: [
        { maxUses: 0 },
        { $expr: { $lt: ['$usedCount', '$maxUses'] } }
      ]
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );

  if (!coupon) {
    throw new ExpressError('Coupon not found or no longer valid', 404);
  }

  return { success: true, coupon: { code: coupon.code } };
});

/**
 * Create a new coupon (admin only)
 * POST /api/coupons
 */
const createCoupon = handleRequest(async (req: Request) => {
  const {
    code,
    discountType,
    discountValue,
    maxUses,
    validFrom,
    validUntil,
    applicablePlans,
    minPurchaseAmount
  } = req.body;

  if (!code || !discountType || discountValue === undefined || !validUntil) {
    throw new ExpressError('Code, discountType, discountValue, and validUntil are required', 400);
  }

  // Check if code already exists
  const existingCoupon = await CouponModel.findOne({ code: code.toUpperCase().trim() });
  if (existingCoupon) {
    throw new ExpressError('A coupon with this code already exists', 400);
  }

  const coupon = await CouponModel.create({
    code: code.toUpperCase().trim(),
    discountType,
    discountValue,
    maxUses: maxUses || 0,
    validFrom: validFrom || new Date(),
    validUntil: new Date(validUntil),
    applicablePlans: applicablePlans || ['all'],
    minPurchaseAmount: minPurchaseAmount || 0,
    isActive: true
  });

  return coupon;
});

/**
 * Get all coupons (admin only)
 * GET /api/coupons
 */
const getAllCoupons = handleRequest(async () => {
  const coupons = await CouponModel.find().sort({ createdAt: -1 });
  return coupons;
});

/**
 * Get a single coupon by ID (admin only)
 * GET /api/coupons/:id
 */
const getCouponById = handleRequest(async (req: Request) => {
  const { id } = req.params;

  const coupon = await CouponModel.findById(id);
  if (!coupon) {
    throw new ExpressError('Coupon not found', 404);
  }

  return coupon;
});

/**
 * Update a coupon (admin only)
 * PUT /api/coupons/:id
 */
const updateCoupon = handleRequest(async (req: Request) => {
  const { id } = req.params;

  const coupon = await CouponModel.findByIdAndUpdate(id, req.body, { new: true });
  if (!coupon) {
    throw new ExpressError('Coupon not found', 404);
  }

  return coupon;
});

/**
 * Delete a coupon (admin only)
 * DELETE /api/coupons/:id
 */
const deleteCoupon = handleRequest(async (req: Request) => {
  const { id } = req.params;

  const coupon = await CouponModel.findByIdAndDelete(id);
  if (!coupon) {
    throw new ExpressError('Coupon not found', 404);
  }

  return { message: 'Coupon deleted successfully' };
});

/**
 * Toggle coupon active status (admin only)
 * PATCH /api/coupons/:id/toggle
 */
const toggleCouponStatus = handleRequest(async (req: Request) => {
  const { id } = req.params;

  const coupon = await CouponModel.findById(id);
  if (!coupon) {
    throw new ExpressError('Coupon not found', 404);
  }

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  return coupon;
});

export default {
  validateCoupon,
  applyCoupon,
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus
};
