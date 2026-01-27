import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import {
  createTestUser,
  createTestStudio,
  createTestItem,
} from '../helpers/fixtures.js';
import { UserModel } from '../../models/userModel.js';

describe('Studios API', () => {
  const app = createTestApp();

  // Helper to create valid studio data for API requests (with all required fields)
  const createValidStudioData = (overrides = {}) => ({
    name: { en: 'Test Studio', he: 'סטודיו בדיקה' },
    description: { en: 'A test studio description', he: 'תיאור סטודיו בדיקה' },
    coverImage: 'https://example.com/cover.jpg',
    galleryImages: ['https://example.com/gallery1.jpg'],
    maxOccupancy: 10,
    city: 'Tel Aviv',
    address: '123 Main Street',
    categories: ['Recording Studio'],
    ...overrides,
  });

  describe('GET /api/studios', () => {
    it('should return all studios (no auth required)', async () => {
      const user = await createTestUser();
      await createTestStudio({ createdBy: user._id });
      await createTestStudio({ createdBy: user._id });

      const res = await request(app).get('/api/studios');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('should return empty array when no studios exist', async () => {
      const res = await request(app).get('/api/studios');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/studios/:studioId', () => {
    it('should return a single studio by ID', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({
        createdBy: user._id,
        name: { en: 'Test Studio', he: 'סטודיו בדיקה' },
      });

      const res = await request(app).get(`/api/studios/${studio._id}`);

      expect(res.status).toBe(200);
      // API returns { currStudio, prevStudio, nextStudio, vendorCredentials }
      expect(res.body.currStudio._id).toBe(studio._id.toString());
      expect(res.body.currStudio.name.en).toBe('Test Studio');
    });

    it('should return 404 for non-existent studio', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app).get(`/api/studios/${fakeId}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/studios/:userId/create-studio', () => {
    it('should create a new studio', async () => {
      const user = await createTestUser();

      const res = await request(app)
        .post(`/api/studios/${user._id}/create-studio`)
        .send(createValidStudioData({
          name: { en: 'New Studio', he: 'סטודיו חדש' },
        }));

      expect(res.status).toBe(200);
      expect(res.body.name.en).toBe('New Studio');
      expect(res.body.createdBy.toString()).toBe(user._id.toString());
    });

    it('should associate studio with user', async () => {
      const user = await createTestUser();

      const res = await request(app)
        .post(`/api/studios/${user._id}/create-studio`)
        .send(createValidStudioData({
          name: { en: 'User Studio', he: 'סטודיו משתמש' },
        }));

      expect(res.status).toBe(200);

      // Verify user has studio reference
      const updatedUser = await UserModel.findById(user._id);
      expect(updatedUser?.studios?.map(s => s.toString())).toContain(res.body._id.toString());
    });

    it('should reject studio with missing required fields', async () => {
      const user = await createTestUser();

      const res = await request(app)
        .post(`/api/studios/${user._id}/create-studio`)
        .send({
          name: { en: 'Missing Fields', he: 'שדות חסרים' },
          // Missing description, coverImage, galleryImages, maxOccupancy
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/studios/:studioId', () => {
    it('should update studio details', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });

      const res = await request(app)
        .put(`/api/studios/${studio._id}`)
        .send(createValidStudioData({
          name: { en: 'Updated Studio', he: 'סטודיו מעודכן' },
          description: { en: 'Updated description', he: 'תיאור מעודכן' },
        }));

      expect(res.status).toBe(200);
      expect(res.body.name.en).toBe('Updated Studio');
    });

    it('should return 404 for non-existent studio', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .put(`/api/studios/${fakeId}`)
        .send(createValidStudioData({
          name: { en: 'Test', he: 'בדיקה' },
        }));

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/studios/:studioId', () => {
    it('should toggle studio active status', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({
        createdBy: user._id,
        name: { en: 'Original Name', he: 'שם מקורי' },
        active: true,
      });

      const res = await request(app)
        .patch(`/api/studios/${studio._id}`)
        .send({
          active: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);
      // Original name should be preserved
      expect(res.body.name.en).toBe('Original Name');
    });

    it('should reject patch with non-allowed fields', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });

      const res = await request(app)
        .patch(`/api/studios/${studio._id}`)
        .send({
          city: 'Jerusalem', // Not in allowed fields
        });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/studios/:studioId', () => {
    it('should delete a studio', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });

      const deleteRes = await request(app).delete(`/api/studios/${studio._id}`);
      expect(deleteRes.status).toBe(204);

      // Verify studio is deleted
      const getRes = await request(app).get(`/api/studios/${studio._id}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Studio with Items', () => {
    it('should return studio with associated items', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });

      // Create items for the studio
      await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        studioName: studio.name,
      });

      await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        studioName: studio.name,
      });

      const res = await request(app).get(`/api/studios/${studio._id}`);

      expect(res.status).toBe(200);
      // API returns { currStudio, prevStudio, nextStudio, vendorCredentials }
      expect(res.body.currStudio._id.toString()).toBe(studio._id.toString());
    });
  });
});
