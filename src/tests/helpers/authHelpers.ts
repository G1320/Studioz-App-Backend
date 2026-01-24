import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { TEST_JWT_SECRET } from './testApp.js';

/**
 * Generate a test JWT token for a user
 * @param userId - The user's MongoDB ObjectId
 * @param expiresIn - Token expiration (default: 1 hour)
 */
export function generateTestToken(
  userId: string | Types.ObjectId,
  expiresIn: string = '1h'
): string {
  return jwt.sign(
    { _id: userId.toString() },
    TEST_JWT_SECRET,
    { expiresIn }
  );
}

/**
 * Generate an expired test JWT token
 */
export function generateExpiredToken(userId: string | Types.ObjectId): string {
  return jwt.sign(
    { _id: userId.toString() },
    TEST_JWT_SECRET,
    { expiresIn: '-1s' }
  );
}

/**
 * Generate an invalid token (wrong secret)
 */
export function generateInvalidToken(userId: string | Types.ObjectId): string {
  return jwt.sign(
    { _id: userId.toString() },
    'wrong-secret-key',
    { expiresIn: '1h' }
  );
}
