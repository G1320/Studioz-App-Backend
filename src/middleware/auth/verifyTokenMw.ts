import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '../../config/index.js';

const { TokenExpiredError } = jwt;

interface CustomRequest extends Request {
  decodedJwt?: JwtPayload;
  signedCookies: {
    accessToken?: string;
  };
}

const verifyTokenMw = (req: CustomRequest, res: Response, next: NextFunction): void => {
  const token = req.signedCookies.accessToken;

  if (!token) {
    res.status(401).json({ message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY as Secret) as JwtPayload;
    req.decodedJwt = decoded;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({ message: 'Token expired' });
    } else {
      res.status(400).json({ message: 'Invalid access token' });
    }
  }
};

export default verifyTokenMw;