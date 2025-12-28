import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { UserModel } from '../../models/userModel.js';

interface CustomRequest extends Request {
  decodedJwt?: JwtPayload & {
    _id?: string;
    userId?: string;
    isAdmin?: boolean;
  };
}

const verifyAdminMw = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.decodedJwt?._id || req.decodedJwt?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Access denied. User not authenticated.' });
      return;
    }

    // Check if user is admin
    const user = await UserModel.findById(userId).select('isAdmin');

    if (!user || !user.isAdmin) {
      res.status(403).json({ message: 'Access denied. Admin privileges required.' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Error verifying admin status' });
  }
};

export default verifyAdminMw;
