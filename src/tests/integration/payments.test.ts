import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import {
  createTestUser,
  createTestVendor,
  createTestVendorWithoutCredentials,
  createTestUserWithSubscription,
} from '../helpers/fixtures.js';
import { generateTestToken } from '../helpers/authHelpers.js';
import { UsageModel } from '../../models/usageModel.js';

// Mock axios for Sumit API calls
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

import axios from 'axios';
const mockedAxios = axios as unknown as { post: ReturnType<typeof vi.fn> };

describe('Payment Endpoints', () => {
  const app = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/sumit/payments/quick-charge', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/sumit/payments/quick-charge')
        .send({
          singleUseToken: 'test-token',
          customerInfo: { name: 'Test', email: 'test@test.com' },
          items: [{ description: 'Test item', price: 100, quantity: 1 }],
          vendorId: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(401);
    });

    it('should block free tier users (no payments feature)', async () => {
      // Create free tier user (no subscription)
      const user = await createTestUser({ subscriptionStatus: undefined });
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post('/api/sumit/payments/quick-charge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          singleUseToken: 'test-token',
          customerInfo: { name: 'Test', email: 'test@test.com' },
          items: [{ description: 'Test item', price: 100, quantity: 1 }],
          vendorId: user._id.toString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FEATURE_UNAVAILABLE');
    });

    it('should allow starter tier users with payments feature', async () => {
      const { user } = await createTestVendor('starter');
      const token = generateTestToken(user._id);

      // Mock successful Sumit API response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          Data: {
            Payment: {
              ID: 12345,
              ValidPayment: true,
              DocumentURL: 'https://example.com/doc',
            },
          },
        },
      });

      const res = await request(app)
        .post('/api/sumit/payments/quick-charge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          singleUseToken: 'test-token',
          customerInfo: { name: 'Test Customer', email: 'test@test.com' },
          items: [{ description: 'Recording session', price: 200, quantity: 1 }],
          vendorId: user._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentId).toBe(12345);
    });

    it('should return 400 for missing required fields', async () => {
      const { user } = await createTestVendor('starter');
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post('/api/sumit/payments/quick-charge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          singleUseToken: 'test-token',
          // Missing customerInfo and items
          vendorId: user._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for vendor without Sumit credentials', async () => {
      const { user } = await createTestVendorWithoutCredentials('starter');
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post('/api/sumit/payments/quick-charge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          singleUseToken: 'test-token',
          customerInfo: { name: 'Test', email: 'test@test.com' },
          items: [{ description: 'Test item', price: 100, quantity: 1 }],
          vendorId: user._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not set up for payments');
    });
  });

  describe('POST /api/sumit/payments/multivendor-charge', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/sumit/payments/multivendor-charge')
        .send({
          items: [{ name: 'Test', price: 100, quantity: 1 }],
          singleUseToken: 'test-token',
          customerInfo: { name: 'Test', email: 'test@test.com' },
          vendorId: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(401);
    });

    it('should require payments feature', async () => {
      const user = await createTestUser({ subscriptionStatus: undefined });
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post('/api/sumit/payments/multivendor-charge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ name: 'Test', price: 100, quantity: 1 }],
          singleUseToken: 'test-token',
          customerInfo: { name: 'Test', email: 'test@test.com' },
          vendorId: user._id.toString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FEATURE_UNAVAILABLE');
    });

    it('should return 400 for invalid items format', async () => {
      const { user } = await createTestVendor('starter');
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post('/api/sumit/payments/multivendor-charge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: 'invalid', // Should be array
          singleUseToken: 'test-token',
          customerInfo: { name: 'Test', email: 'test@test.com' },
          vendorId: user._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid items format');
    });
  });

  describe('Payment limits', () => {
    it('should block payments when monthly limit exceeded (starter: 25)', async () => {
      const { user } = await createTestVendor('starter');
      const token = generateTestToken(user._id);

      // Create usage record showing 25 payments already processed
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      await UsageModel.create({
        userId: user._id,
        month: currentMonth,
        paymentsProcessed: 25,
        paymentsTotal: 5000,
      });

      const res = await request(app)
        .post('/api/sumit/payments/quick-charge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          singleUseToken: 'test-token',
          customerInfo: { name: 'Test', email: 'test@test.com' },
          items: [{ description: 'Test item', price: 100, quantity: 1 }],
          vendorId: user._id.toString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('LIMIT_EXCEEDED');
      expect(res.body.limitType).toBe('paymentsPerMonth');
      expect(res.body.currentUsage).toBe(25);
      expect(res.body.limit).toBe(25);
    });

    it('should allow payments for pro tier (limit: 200)', async () => {
      const { user } = await createTestVendor('pro');
      const token = generateTestToken(user._id);

      // Create usage record showing 100 payments (still under 200)
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      await UsageModel.create({
        userId: user._id,
        month: currentMonth,
        paymentsProcessed: 100,
        paymentsTotal: 20000,
      });

      // Mock successful Sumit API response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          Data: {
            Payment: {
              ID: 12345,
              ValidPayment: true,
              DocumentURL: 'https://example.com/doc',
            },
          },
        },
      });

      const res = await request(app)
        .post('/api/sumit/payments/quick-charge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          singleUseToken: 'test-token',
          customerInfo: { name: 'Test Customer', email: 'test@test.com' },
          items: [{ description: 'Recording session', price: 200, quantity: 1 }],
          vendorId: user._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/sumit/payments/charge-saved-card', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/sumit/payments/charge-saved-card')
        .send({
          sumitCustomerId: '12345',
          amount: 100,
          vendorId: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(401);
    });

    it('should require payments feature', async () => {
      const user = await createTestUser({ subscriptionStatus: undefined });
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post('/api/sumit/payments/charge-saved-card')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sumitCustomerId: '12345',
          amount: 100,
          vendorId: user._id.toString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FEATURE_UNAVAILABLE');
    });
  });

  describe('POST /api/sumit/payments/create-invoice', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/sumit/payments/create-invoice')
        .send({
          vendorId: '507f1f77bcf86cd799439011',
          customerInfo: { name: 'Test', email: 'test@test.com' },
          items: [{ description: 'Test', price: 100, quantity: 1 }],
        });

      expect(res.status).toBe(401);
    });

    it('should require payments feature', async () => {
      const user = await createTestUser({ subscriptionStatus: undefined });
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post('/api/sumit/payments/create-invoice')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vendorId: user._id.toString(),
          customerInfo: { name: 'Test', email: 'test@test.com' },
          items: [{ description: 'Test', price: 100, quantity: 1 }],
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FEATURE_UNAVAILABLE');
    });

    it('should allow pro tier to create invoices', async () => {
      const { user } = await createTestVendor('pro');
      const token = generateTestToken(user._id);

      // Mock successful Sumit API response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          Status: 0,
          Data: {
            DocumentID: 67890,
            DocumentNumber: 'INV-001',
            CustomerID: 12345,
            DocumentDownloadURL: 'https://example.com/invoice.pdf',
          },
        },
      });

      const res = await request(app)
        .post('/api/sumit/payments/create-invoice')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vendorId: user._id.toString(),
          customerInfo: { name: 'Test Customer', email: 'test@test.com' },
          items: [{ description: 'Recording session', price: 300, quantity: 2 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentId).toBe(67890);
    });
  });

  describe('POST /api/sumit/payments/refund', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/sumit/payments/refund')
        .send({
          sumitPaymentId: '12345',
          amount: 100,
          vendorId: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(401);
    });

    it('should return 400 for missing required fields', async () => {
      const { user } = await createTestUserWithSubscription('starter');
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post('/api/sumit/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          // Missing sumitPaymentId
          amount: 100,
          vendorId: user._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Public payment endpoints', () => {
    describe('POST /api/sumit/payments/save-card', () => {
      it('should not require authentication (public endpoint)', async () => {
        const { user } = await createTestVendor('starter');

        // Mock successful save card response
        mockedAxios.post.mockResolvedValueOnce({
          data: {
            Data: {
              CustomerID: 99999,
              PaymentMethod: {
                CreditCard_LastDigits: '4242',
                CreditCard_Token: 'tok_test123',
              },
            },
          },
        });

        const res = await request(app)
          .post('/api/sumit/payments/save-card')
          .send({
            singleUseToken: 'test-token',
            customerInfo: {
              name: 'Test Customer',
              email: 'test@test.com',
              phone: '0501234567',
            },
            vendorId: user._id.toString(),
          });

        // Should not be 401 - this endpoint is public
        expect(res.status).not.toBe(401);
      });

      it('should return 400 for missing fields', async () => {
        const res = await request(app)
          .post('/api/sumit/payments/save-card')
          .send({
            // Missing required fields
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });
    });

    describe('POST /api/sumit/payments/webhook', () => {
      it('should accept webhook events', async () => {
        const res = await request(app)
          .post('/api/sumit/payments/webhook')
          .send({
            EventType: 'payment.success',
            PaymentId: '12345',
          });

        expect(res.status).toBe(200);
        expect(res.body.received).toBe(true);
      });
    });
  });
});
