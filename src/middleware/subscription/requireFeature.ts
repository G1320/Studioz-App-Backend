import { Request, Response, NextFunction } from 'express';
import { usageService } from '../../services/usageService.js';
import {
  tierHasFeature,
  FeatureId,
  SubscriptionTier,
  FEATURE_REQUIRED_TIER
} from '../../config/subscriptionTiers.js';

interface AuthRequest extends Request {
  user?: { id: string };
  decodedJwt?: { _id?: string; userId?: string; sub?: string };
  subscriptionTier?: SubscriptionTier;
}

/**
 * Middleware factory to require access to a specific feature
 *
 * @example
 * router.post('/charge', requireFeature('payments'), handler);
 * router.get('/analytics', requireFeature('analytics'), handler);
 */
export const requireFeature = (feature: FeatureId) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
      
      const currentTier = await usageService.getUserTier(userId);
      
      // Attach tier to request for downstream use
      req.subscriptionTier = currentTier;
      
      if (!tierHasFeature(currentTier, feature)) {
        const requiredTier = FEATURE_REQUIRED_TIER[feature];
        
        res.status(403).json({
          error: 'FEATURE_UNAVAILABLE',
          message: `The "${feature}" feature is not available on your current plan`,
          feature,
          currentTier,
          requiredTier,
          upgradeUrl: '/subscription'
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('requireFeature middleware error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Error checking feature access'
      });
    }
  };
};

export default requireFeature;
