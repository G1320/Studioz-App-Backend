import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '../../config/index.js';

interface CustomRequest extends Request {
  decodedJwt?: JwtPayload;
  signedCookies: {
    accessToken?: string;
  };
}

const verifyTokenMw = (req: CustomRequest, res: Response, next: NextFunction): void => {
  let token = req.signedCookies.accessToken;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY as Secret) as JwtPayload;
    req.decodedJwt = decoded;
    next();
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Token expired' });
    } else {
      res.status(400).json({ message: 'Invalid access token' });
    }
  }
};

export default verifyTokenMw;
