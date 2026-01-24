import { Request, Response, NextFunction } from 'express';
import { usageService } from '../../services/usageService.js';
import { SubscriptionTier } from '../../config/subscriptionTiers.js';

interface AuthRequest extends Request {
  user?: { id: string };
  decodedJwt?: { _id?: string; userId?: string; sub?: string };
  subscriptionTier?: SubscriptionTier;
  listingCheck?: {
    allowed: boolean;
    current: number;
    limit: number;
    tier: SubscriptionTier;
  };
}

/**
 * Middleware to check if user has reached their listing limit
 *
 * @example
 * router.post('/items',
 *   verifyToken,
 *   checkListingLimit,
 *   validateItem,
 *   handler
 * );
 */
export const checkListingLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Support both req.user (passport) and req.decodedJwt (verifyTokenMw)
    const userId = req.user?.id || req.decodedJwt?._id || req.decodedJwt?.userId;
    
    if (!userId) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
      return;
    }
    
    const check = await usageService.canCreateListing(userId);
    
    // Attach check result to request for use in handler
    req.listingCheck = check;
    req.subscriptionTier = check.tier;
    
    if (!check.allowed) {
      res.status(403).json({
        error: 'LIMIT_EXCEEDED',
        message: 'Listing limit reached for your plan. Upgrade to create more listings.',
        limitType: 'listings',
        currentUsage: check.current,
        limit: check.limit,
        tier: check.tier,
        upgradeUrl: '/subscription'
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('checkListingLimit middleware error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Error checking listing limit'
    });
  }
};

export default checkListingLimit;
