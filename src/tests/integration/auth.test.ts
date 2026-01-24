import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import {
  createTestUser,
  createTestUserWithSubscription,
} from '../helpers/fixtures.js';
import {
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,
} from '../helpers/authHelpers.js';

describe('Authentication Middleware', () => {
  const app = createTestApp();

  describe('verifyTokenMw', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/google/calendar/status');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Access denied. No token provided.');
    });

    it('should return 401 when token is expired', async () => {
      const user = await createTestUser();
      const expiredToken = generateExpiredToken(user._id);

      const res = await request(app)
        .get('/api/auth/google/calendar/status')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Token expired');
    });

    it('should return 400 when token is invalid', async () => {
      const user = await createTestUser();
      const invalidToken = generateInvalidToken(user._id);

      const res = await request(app)
        .get('/api/auth/google/calendar/status')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid access token');
    });

    it('should pass authentication with valid token', async () => {
      // Create user with starter subscription (has googleCalendar feature)
      const { user } = await createTestUserWithSubscription('starter');
      const token = generateTestToken(user._id);

      const res = await request(app)
        .get('/api/auth/google/calendar/status')
        .set('Authorization', `Bearer ${token}`);

      // Should pass auth middleware - may return 200 (not connected) or error from handler
      // The point is it shouldn't be 401/400 from auth middleware
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(400);
    });
  });

  describe('requireFeature middleware', () => {
    it('should return 403 when user is on free tier accessing paid feature', async () => {
      // Create user without subscription (free tier)
      const user = await createTestUser({ subscriptionStatus: undefined });
      const token = generateTestToken(user._id);

      const res = await request(app)
        .get('/api/auth/google/calendar/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FEATURE_UNAVAILABLE');
      expect(res.body.feature).toBe('googleCalendar');
      expect(res.body.currentTier).toBe('free');
      expect(res.body.requiredTier).toBe('starter');
    });

    it('should allow access for starter tier user to googleCalendar feature', async () => {
      const { user } = await createTestUserWithSubscription('starter');
      const token = generateTestToken(user._id);

      const res = await request(app)
        .get('/api/auth/google/calendar/status')
        .set('Authorization', `Bearer ${token}`);

      // Should not be 403 - feature is available
      expect(res.status).not.toBe(403);
      // Response should be 200 with connected: false (no calendar connected yet)
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('connected');
    });

    it('should allow access for pro tier user to googleCalendar feature', async () => {
      const { user } = await createTestUserWithSubscription('pro');
      const token = generateTestToken(user._id);

      const res = await request(app)
        .get('/api/auth/google/calendar/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
    });
  });
});
