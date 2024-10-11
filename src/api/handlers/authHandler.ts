import { Request, Response } from 'express';
import { NODE_ENV, JWT_REFRESH_KEY, JWT_SECRET_KEY } from '../../config/index.js';
import { UserModel } from '../../models/userModel.js';
import ExpressError from '../../utils/expressError.js';
import handleRequest from '../../utils/requestHandler.js';
import jwt from 'jsonwebtoken';

const createAndRegisterUser = handleRequest(async (req: Request, res: Response) => {
  try {
    const user = await new UserModel(req.body).save();
    const accessToken = jwt.sign({ _id: user._id }, JWT_SECRET_KEY as string, {
      expiresIn: '15m'
    });
    const refreshToken = jwt.sign({ _id: user._id }, JWT_REFRESH_KEY as string, {
      expiresIn: '7d'
    });
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      maxAge: 36000000,
      signed: true
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      maxAge: 604800000,
      signed: true
    });
    return { accessToken: accessToken, user: user };
  } catch (error) {
    console.error('Error creating and registering user:', error);
    throw new ExpressError('Error during registration', 500);
  }
});

const loginUser = handleRequest(async (req: Request, res: Response) => {
  const user = await UserModel.findOne({ sub: req.body.sub });

  if (!user) throw new ExpressError('User not found', 404);

  const accessToken = jwt.sign({ _id: user._id }, JWT_SECRET_KEY as string, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ _id: user._id }, JWT_REFRESH_KEY as string, { expiresIn: '7d' });

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    signed: true,
    secure: NODE_ENV === 'production',
    maxAge: 36000000
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    signed: true,
    secure: NODE_ENV === 'production',
    maxAge: 604800000
  });
  return { accessToken: accessToken, user: user };
});

const refreshAccessToken = handleRequest(async (req: Request, res: Response) => {
  try {
    const refreshToken = req.signedCookies.refreshToken;
    if (!refreshToken) throw new ExpressError('No refresh token provided', 401);

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_KEY as string) as { _id: string };
    const accessToken = jwt.sign({ _id: decoded._id }, JWT_SECRET_KEY as string, { expiresIn: '15m' });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      signed: true,
      secure: NODE_ENV === 'production',
      maxAge: 36000000
    });
    console.log('Generated new access token');

    return { accessToken: accessToken };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw new ExpressError('Error refreshing access token', 500);
  }
});

const logoutUser = handleRequest(async (req: Request, res: Response) => {
  try {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return { message: 'Logged out successfully' };
  } catch (error) {
    console.error('Failed to clear authentication cookies:', error);
    throw new ExpressError('Logout failed', 500);
  }
});

export default {
  createAndRegisterUser,
  loginUser,
  refreshAccessToken,
  logoutUser
};
