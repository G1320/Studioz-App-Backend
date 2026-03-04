import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/userModel.js';

interface AuthRequest extends Request {
  user?: { id: string };
  decodedJwt?: { _id?: string; userId?: string; sub?: string };
}

/**
 * Middleware to require full Sumit setup for the vendor:
 * - sumitCompanyId, sumitApiKey (vendor onboarding)
 * - sumitCustomerId (card on file for platform fee billing)
 *
 * Use on payment charge routes so vendors cannot receive payments until
 * they have completed onboarding and added a card for platform fees.
 */
export const requireSumitSetup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id || req.decodedJwt?._id || req.decodedJwt?.userId;

    if (!userId) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
      return;
    }

    const user = await UserModel.findById(userId).select('sumitCompanyId sumitApiKey sumitCustomerId');

    if (!user) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const hasVendorCredentials = Boolean(user.sumitCompanyId && user.sumitApiKey);
    const hasCardOnFile = Boolean(user.sumitCustomerId);

    if (!hasVendorCredentials || !hasCardOnFile) {
      res.status(403).json({
        error: 'SUMIT_SETUP_REQUIRED',
        message: 'Complete payment setup (Sumit onboarding and add a card for platform fees) to process payments',
        setupUrl: '/onboarding'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('requireSumitSetup middleware error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Error checking payment setup'
    });
  }
};

export default requireSumitSetup;
