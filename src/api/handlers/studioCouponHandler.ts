import { Request } from 'express';
import { StudioCouponModel, IStudioCoupon } from '../../models/studioCouponModel.js';
import { StudioCouponUsageModel } from '../../models/studioCouponUsageModel.js';
import { StudioModel } from '../../models/studioModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';

// Extended Request type with user info from auth middleware
interface AuthRequest extends Request {
  user?: {
    id: string;
    sub: string;
    isAdmin?: boolean;
  };
}

/**
 * Verify that the user owns the studio
 */
const verifyStudioOwnership = async (studioId: string, userId: string): Promise<void> => {
  const studio = await StudioModel.findById(studioId);
  if (!studio) {
    throw new ExpressError('Studio not found', 404);
  }
  if (studio.createdBy?.toString() !== userId) {
    throw new ExpressError('You do not have permission to manage coupons for this studio', 403);
  }
};

/**
 * Create a new studio coupon
 * POST /api/studio-coupons
 */
const createStudioCoupon = handleRequest(async (req: AuthRequest) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ExpressError('Authentication required', 401);
  }

  const {
    code,
    studioId,
    discountType,
    discountValue,
    maxUses,
    maxUsesPerCustomer,
    validFrom,
    validUntil,
    applicableItems,
    minBookingHours,
    minPurchaseAmount,
    description
  } = req.body;

  if (!code || !studioId || !discountType || discountValue === undefined || !validUntil) {
    throw new ExpressError('Code, studioId, discountType, discountValue, and validUntil are required', 400);
  }

  // Verify studio ownership
  await verifyStudioOwnership(studioId, userId);

  // Validate discount value
  if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
    throw new ExpressError('Percentage discount must be between 0 and 100', 400);
  }
  if (discountType === 'fixed' && discountValue < 0) {
    throw new ExpressError('Fixed discount cannot be negative', 400);
  }

  // Check if code already exists for this studio
  const existingCoupon = await StudioCouponModel.findOne({
    code: code.toUpperCase().trim(),
    studioId
  });
  if (existingCoupon) {
    throw new ExpressError('A coupon with this code already exists for this studio', 400);
  }

  const coupon = await StudioCouponModel.create({
    code: code.toUpperCase().trim(),
    studioId,
    createdBy: userId,
    discountType,
    discountValue,
    maxUses: maxUses || 0,
    maxUsesPerCustomer: maxUsesPerCustomer || 0,
    validFrom: validFrom || new Date(),
    validUntil: new Date(validUntil),
    applicableItems: applicableItems || ['all'],
    minBookingHours: minBookingHours || 0,
    minPurchaseAmount: minPurchaseAmount || 0,
    description: description || '',
    isActive: true
  });

  return coupon;
});

/**
 * Validate a studio coupon for a booking
 * POST /api/studio-coupons/validate
 */
const validateStudioCoupon = handleRequest(async (req: AuthRequest) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ExpressError('Authentication required', 401);
  }

  const { code, studioId, itemId, amount, bookingHours } = req.body;

  if (!code || !studioId) {
    throw new ExpressError('Coupon code and studioId are required', 400);
  }

  const coupon = await StudioCouponModel.findOne({
    code: code.toUpperCase().trim(),
    studioId,
    isActive: true
  });

  if (!coupon) {
    throw new ExpressError('Invalid coupon code', 404);
  }

  // Check date validity
  const now = new Date();
  if (now < coupon.validFrom) {
    throw new ExpressError('This coupon is not yet valid', 400);
  }
  if (now > coupon.validUntil) {
    throw new ExpressError('This coupon has expired', 400);
  }

  // Check global usage limit
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    throw new ExpressError('This coupon has reached its usage limit', 400);
  }

  // Check per-customer usage limit
  if (coupon.maxUsesPerCustomer > 0) {
    const customerUsageCount = await StudioCouponUsageModel.countDocuments({
      couponId: coupon._id,
      customerId: userId
    });
    if (customerUsageCount >= coupon.maxUsesPerCustomer) {
      throw new ExpressError('You have already used this coupon the maximum number of times', 400);
    }
  }

  // Check minimum booking hours
  if (coupon.minBookingHours && bookingHours && bookingHours < coupon.minBookingHours) {
    throw new ExpressError(`Minimum booking of ${coupon.minBookingHours} hours required for this coupon`, 400);
  }

  // Check minimum purchase amount
  if (coupon.minPurchaseAmount && amount && amount < coupon.minPurchaseAmount) {
    throw new ExpressError(`Minimum purchase amount of ₪${coupon.minPurchaseAmount} required`, 400);
  }

  // Check item applicability
  if (itemId && !coupon.applicableItems.includes('all') && !coupon.applicableItems.includes(itemId)) {
    throw new ExpressError('This coupon is not applicable to the selected item', 400);
  }

  // Calculate discount
  let discountAmount = 0;
  if (amount) {
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((amount * coupon.discountValue) / 100);
    } else {
      discountAmount = Math.min(coupon.discountValue, amount);
    }
  }

  return {
    valid: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      description: coupon.description
    }
  };
});

/**
 * Apply a studio coupon (increment usage count and record usage)
 * POST /api/studio-coupons/apply
 */
const applyStudioCoupon = handleRequest(async (req: AuthRequest) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ExpressError('Authentication required', 401);
  }

  const { code, studioId, reservationId, discountAmount } = req.body;

  if (!code || !studioId) {
    throw new ExpressError('Coupon code and studioId are required', 400);
  }

  // Atomically increment usage count with validation
  const coupon = await StudioCouponModel.findOneAndUpdate(
    {
      code: code.toUpperCase().trim(),
      studioId,
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

  // Record usage for per-customer tracking
  await StudioCouponUsageModel.create({
    couponId: coupon._id,
    customerId: userId,
    studioId,
    reservationId,
    discountAmount: discountAmount || 0,
    usedAt: new Date()
  });

  return { success: true, coupon: { code: coupon.code } };
});

/**
 * Get all coupons for a studio (owner only)
 * GET /api/studio-coupons/studio/:studioId
 */
const getStudioCoupons = handleRequest(async (req: AuthRequest) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ExpressError('Authentication required', 401);
  }

  const { studioId } = req.params;
  if (!studioId) {
    throw new ExpressError('Studio ID is required', 400);
  }

  // Verify studio ownership
  await verifyStudioOwnership(studioId, userId);

  const coupons = await StudioCouponModel.find({ studioId }).sort({ createdAt: -1 });
  return coupons;
});

/**
 * Get a single coupon by ID (owner only)
 * GET /api/studio-coupons/:id
 */
const getStudioCouponById = handleRequest(async (req: AuthRequest) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ExpressError('Authentication required', 401);
  }

  const { id } = req.params;
  const coupon = await StudioCouponModel.findById(id);

  if (!coupon) {
    throw new ExpressError('Coupon not found', 404);
  }

  // Verify ownership
  await verifyStudioOwnership(coupon.studioId.toString(), userId);

  return coupon;
});

/**
 * Update a studio coupon (owner only)
 * PUT /api/studio-coupons/:id
 */
const updateStudioCoupon = handleRequest(async (req: AuthRequest) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ExpressError('Authentication required', 401);
  }

  const { id } = req.params;
  const coupon = await StudioCouponModel.findById(id);

  if (!coupon) {
    throw new ExpressError('Coupon not found', 404);
  }

  // Verify ownership
  await verifyStudioOwnership(coupon.studioId.toString(), userId);

  // Prevent changing studioId or createdBy
  const { studioId, createdBy, usedCount, ...updateData } = req.body;

  // Validate discount if being updated
  if (updateData.discountType === 'percentage' && updateData.discountValue !== undefined) {
    if (updateData.discountValue < 0 || updateData.discountValue > 100) {
      throw new ExpressError('Percentage discount must be between 0 and 100', 400);
    }
  }

  // If code is being changed, check for duplicates
  if (updateData.code && updateData.code.toUpperCase().trim() !== coupon.code) {
    const existingCoupon = await StudioCouponModel.findOne({
      code: updateData.code.toUpperCase().trim(),
      studioId: coupon.studioId,
      _id: { $ne: id }
    });
    if (existingCoupon) {
      throw new ExpressError('A coupon with this code already exists for this studio', 400);
    }
    updateData.code = updateData.code.toUpperCase().trim();
  }

  const updatedCoupon = await StudioCouponModel.findByIdAndUpdate(id, updateData, { new: true });
  return updatedCoupon;
});

/**
 * Delete a studio coupon (owner only)
 * DELETE /api/studio-coupons/:id
 */
const deleteStudioCoupon = handleRequest(async (req: AuthRequest) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ExpressError('Authentication required', 401);
  }

  const { id } = req.params;
  const coupon = await StudioCouponModel.findById(id);

  if (!coupon) {
    throw new ExpressError('Coupon not found', 404);
  }

  // Verify ownership
  await verifyStudioOwnership(coupon.studioId.toString(), userId);

  await StudioCouponModel.findByIdAndDelete(id);

  // Optionally keep usage records for analytics, or delete them:
  // await StudioCouponUsageModel.deleteMany({ couponId: id });

  return { message: 'Coupon deleted successfully' };
});

/**
 * Toggle coupon active status (owner only)
 * PATCH /api/studio-coupons/:id/toggle
 */
const toggleStudioCouponStatus = handleRequest(async (req: AuthRequest) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ExpressError('Authentication required', 401);
  }

  const { id } = req.params;
  const coupon = await StudioCouponModel.findById(id);

  if (!coupon) {
    throw new ExpressError('Coupon not found', 404);
  }

  // Verify ownership
  await verifyStudioOwnership(coupon.studioId.toString(), userId);

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  return coupon;
});

/**
 * Get coupon usage statistics (owner only)
 * GET /api/studio-coupons/:id/stats
 */
const getStudioCouponStats = handleRequest(async (req: AuthRequest) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ExpressError('Authentication required', 401);
  }

  const { id } = req.params;
  const coupon = await StudioCouponModel.findById(id);

  if (!coupon) {
    throw new ExpressError('Coupon not found', 404);
  }

  // Verify ownership
  await verifyStudioOwnership(coupon.studioId.toString(), userId);

  // Get usage statistics
  const [totalUsage, uniqueCustomers, totalDiscount, recentUsage] = await Promise.all([
    StudioCouponUsageModel.countDocuments({ couponId: id }),
    StudioCouponUsageModel.distinct('customerId', { couponId: id }).then(arr => arr.length),
    StudioCouponUsageModel.aggregate([
      { $match: { couponId: coupon._id } },
      { $group: { _id: null, total: { $sum: '$discountAmount' } } }
    ]).then(result => result[0]?.total || 0),
    StudioCouponUsageModel.find({ couponId: id })
      .sort({ usedAt: -1 })
      .limit(10)
      .populate('customerId', 'name email')
  ]);

  return {
    coupon: {
      code: coupon.code,
      usedCount: coupon.usedCount,
      maxUses: coupon.maxUses,
      isActive: coupon.isActive
    },
    stats: {
      totalUsage,
      uniqueCustomers,
      totalDiscountGiven: totalDiscount,
      remainingUses: coupon.maxUses > 0 ? coupon.maxUses - coupon.usedCount : 'unlimited'
    },
    recentUsage
  };
});

export default {
  createStudioCoupon,
  validateStudioCoupon,
  applyStudioCoupon,
  getStudioCoupons,
  getStudioCouponById,
  updateStudioCoupon,
  deleteStudioCoupon,
  toggleStudioCouponStatus,
  getStudioCouponStats
};
