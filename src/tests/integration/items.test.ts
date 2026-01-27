import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import {
  createTestUser,
  createTestStudio,
  createTestItem,
  createTestUserWithSubscription,
} from '../helpers/fixtures.js';
import { generateTestToken } from '../helpers/authHelpers.js';
import { UserModel } from '../../models/userModel.js';

describe('Items API', () => {
  const app = createTestApp();

  describe('POST /api/items (Create Item)', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/items')
        .send({
          name: { en: 'Test Item' },
          price: 100,
        });

      expect(res.status).toBe(401);
    });

    it('should allow creating first item for free tier user', async () => {
      // Create free tier user (no subscription)
      const user = await createTestUser({ subscriptionStatus: undefined });
      const studio = await createTestStudio({ createdBy: user._id });

      // Associate studio with user
      await UserModel.findByIdAndUpdate(user._id, {
        $push: { studios: studio._id }
      });

      const token = generateTestToken(user._id);

      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: { en: 'Test Item', he: 'פריט בדיקה' },
          studioName: studio.name,
          studioId: studio._id.toString(),
          sellerId: user._id.toString(),
          price: 100,
          pricePer: 'hour',
        });

      expect(res.status).toBe(200);
      expect(res.body.name.en).toBe('Test Item');
    });

    it('should block second item for free tier user (limit: 1)', async () => {
      // Create free tier user
      const user = await createTestUser({ subscriptionStatus: undefined });
      const studio = await createTestStudio({ createdBy: user._id });

      // Associate studio with user
      await UserModel.findByIdAndUpdate(user._id, {
        $push: { studios: studio._id }
      });

      // Create first item directly in DB (simulating existing item)
      await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
      });

      const token = generateTestToken(user._id);

      // Try to create second item - should be blocked by checkListingLimit middleware
      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: { en: 'Second Item', he: 'פריט שני' },
          studioName: studio.name,
          studioId: studio._id.toString(),
          sellerId: user._id.toString(),
          price: 150,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('LIMIT_EXCEEDED');
      expect(res.body.limitType).toBe('listings');
      expect(res.body.currentUsage).toBe(1);
      expect(res.body.limit).toBe(1);
    });

    it('should allow starter tier user to create up to 3 items', async () => {
      const { user } = await createTestUserWithSubscription('starter');
      const studio = await createTestStudio({ createdBy: user._id });

      // Associate studio with user
      await UserModel.findByIdAndUpdate(user._id, {
        $push: { studios: studio._id }
      });

      // Create first 2 items directly
      await createTestItem({ studioId: studio._id, sellerId: user._id });
      await createTestItem({ studioId: studio._id, sellerId: user._id });

      const token = generateTestToken(user._id);

      // Third item should succeed (limit is 3)
      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: { en: 'Third Item', he: 'פריט שלישי' },
          studioName: studio.name,
          studioId: studio._id.toString(),
          sellerId: user._id.toString(),
          price: 200,
        });

      expect(res.status).toBe(200);
      expect(res.body.name.en).toBe('Third Item');
    });

    it('should block fourth item for starter tier user (limit: 3)', async () => {
      const { user } = await createTestUserWithSubscription('starter');
      const studio = await createTestStudio({ createdBy: user._id });

      // Associate studio with user
      await UserModel.findByIdAndUpdate(user._id, {
        $push: { studios: studio._id }
      });

      // Create 3 items (at limit)
      await createTestItem({ studioId: studio._id, sellerId: user._id });
      await createTestItem({ studioId: studio._id, sellerId: user._id });
      await createTestItem({ studioId: studio._id, sellerId: user._id });

      const token = generateTestToken(user._id);

      // Fourth item should be blocked
      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: { en: 'Fourth Item' },
          studioId: studio._id.toString(),
          sellerId: user._id.toString(),
          price: 200,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('LIMIT_EXCEEDED');
      expect(res.body.tier).toBe('starter');
      expect(res.body.currentUsage).toBe(3);
      expect(res.body.limit).toBe(3);
    });

    it('should allow unlimited items for pro tier user', async () => {
      const { user } = await createTestUserWithSubscription('pro');
      const studio = await createTestStudio({ createdBy: user._id });

      // Associate studio with user
      await UserModel.findByIdAndUpdate(user._id, {
        $push: { studios: studio._id }
      });

      // Create multiple items directly
      await createTestItem({ studioId: studio._id, sellerId: user._id });
      await createTestItem({ studioId: studio._id, sellerId: user._id });

      const token = generateTestToken(user._id);

      // Pro user should be able to create more items
      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: { en: 'Third Item', he: 'פריט שלישי' },
          studioName: studio.name,
          studioId: studio._id.toString(),
          sellerId: user._id.toString(),
          price: 300,
        });

      expect(res.status).toBe(200);
      expect(res.body.name.en).toBe('Third Item');
    });
  });

  describe('GET /api/items', () => {
    it('should return all items (no auth required)', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });

      await createTestItem({ studioId: studio._id, sellerId: user._id });
      await createTestItem({ studioId: studio._id, sellerId: user._id });

      const res = await request(app).get('/api/items');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });
  });

  describe('GET /api/items/:itemId', () => {
    it('should return a single item by ID', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });
      const item = await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        name: { en: 'Specific Item', he: 'פריט ספציפי' }
      });

      const res = await request(app).get(`/api/items/${item._id}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(item._id.toString());
      expect(res.body.name.en).toBe('Specific Item');
    });

    it('should return 404 for non-existent item', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app).get(`/api/items/${fakeId}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/items/:itemId', () => {
    it('should delete an item and free up listing slot', async () => {
      const { user } = await createTestUserWithSubscription('starter');
      const studio = await createTestStudio({ createdBy: user._id });

      await UserModel.findByIdAndUpdate(user._id, {
        $push: { studios: studio._id }
      });

      // Create an item
      const item = await createTestItem({
        studioId: studio._id,
        sellerId: user._id
      });

      const token = generateTestToken(user._id);

      // Delete the item
      const deleteRes = await request(app)
        .delete(`/api/items/${item._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);

      // Now should be able to create a new item (slot freed)
      const createRes = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: { en: 'Replacement Item', he: 'פריט חלופי' },
          studioName: studio.name,
          studioId: studio._id.toString(),
          sellerId: user._id.toString(),
          price: 100,
        });

      expect(createRes.status).toBe(200);
    });
  });
});
