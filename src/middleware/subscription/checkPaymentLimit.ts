import { Request, Response, NextFunction } from 'express';
import { usageService } from '../../services/usageService.js';
import { SubscriptionTier } from '../../config/subscriptionTiers.js';

interface AuthRequest extends Request {
  user?: { id: string };
  subscriptionTier?: SubscriptionTier;
  paymentCheck?: {
    allowed: boolean;
    current: number;
    limit: number;
    remaining: number;
    tier: SubscriptionTier;
  };
}

/**
 * Middleware to check if user has reached their monthly payment limit
 * Should be used after requireFeature('payments') to ensure user has payment access
 * 
 * @example
 * router.post('/charge', 
 *   requireFeature('payments'), 
 *   checkPaymentLimit, 
 *   handler
 * );
 */
export const checkPaymentLimit = async (
  req: AuthRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
      return;
    }
    
    const check = await usageService.canProcessPayment(userId);
    
    // Attach check result to request for use in handler (e.g., showing remaining)
    req.paymentCheck = check;
    req.subscriptionTier = check.tier;
    
    if (!check.allowed) {
      res.status(403).json({
        error: 'LIMIT_EXCEEDED',
        message: 'Monthly payment limit reached. Upgrade your plan to process more payments.',
        limitType: 'paymentsPerMonth',
        currentUsage: check.current,
        limit: check.limit,
        tier: check.tier,
        upgradeUrl: '/subscription'
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('checkPaymentLimit middleware error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Error checking payment limit'
    });
  }
};

export default checkPaymentLimit;
