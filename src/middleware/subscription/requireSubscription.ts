import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../../models/userModel.js';
import { SubscriptionModel } from '../../models/sumitModels/subscriptionModel.js';

interface AuthRequest extends Request {
  user?: { id: string };
}

/**
 * Middleware to require an active subscription
 * Use this for features that require any paid plan
 */
export const requireSubscription = async (
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
    
    const user = await UserModel.findById(userId);
    
    if (!user) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }
    
    // Check if user has an active subscription
    if (!user.subscriptionId || user.subscriptionStatus !== 'ACTIVE') {
      res.status(403).json({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'An active subscription is required for this action',
        upgradeUrl: '/subscription'
      });
      return;
    }
    
    // Verify subscription exists and is active
    const subscription = await SubscriptionModel.findById(user.subscriptionId);
    
    if (!subscription || (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL')) {
      res.status(403).json({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'An active subscription is required for this action',
        upgradeUrl: '/subscription'
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('requireSubscription middleware error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Error checking subscription status'
    });
  }
};

export default requireSubscription;
