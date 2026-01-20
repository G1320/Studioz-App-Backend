import { Request, Response, NextFunction } from 'express';
import { usageService } from '../../services/usageService.js';
import { tierMeetsMinimum, SubscriptionTier } from '../../config/subscriptionTiers.js';

interface AuthRequest extends Request {
  user?: { id: string };
  subscriptionTier?: SubscriptionTier;
}

/**
 * Middleware factory to require a minimum subscription tier
 * 
 * @example
 * router.get('/pro-feature', requireTier('pro'), handler);
 * router.get('/starter-feature', requireTier('starter'), handler);
 */
export const requireTier = (requiredTier: SubscriptionTier) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        });
        return;
      }
      
      const currentTier = await usageService.getUserTier(userId);
      
      // Attach tier to request for downstream use
      req.subscriptionTier = currentTier;
      
      if (!tierMeetsMinimum(currentTier, requiredTier)) {
        res.status(403).json({
          error: 'TIER_INSUFFICIENT',
          message: `This feature requires ${requiredTier} tier or higher`,
          currentTier,
          requiredTier,
          upgradeUrl: '/subscription'
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('requireTier middleware error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Error checking subscription tier'
      });
    }
  };
};

export default requireTier;
