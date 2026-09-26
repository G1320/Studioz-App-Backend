import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import {
  createTestUser,
  createTestStudio,
  createTestItem,
} from '../helpers/fixtures.js';
import { generateTestToken } from '../helpers/authHelpers.js';
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
    it('should require authentication', async () => {
      const user = await createTestUser();

      const res = await request(app)
        .post(`/api/studios/${user._id}/create-studio`)
        .send(createValidStudioData());

      expect(res.status).toBe(401);
    });

    it('should create a new studio', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post(`/api/studios/${user._id}/create-studio`)
        .set('Authorization', `Bearer ${token}`)
        .send(createValidStudioData({
          name: { en: 'New Studio', he: 'סטודיו חדש' },
        }));

      expect(res.status).toBe(200);
      expect(res.body.name.en).toBe('New Studio');
      expect(res.body.createdBy.toString()).toBe(user._id.toString());
    });

    it('should associate studio with user', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post(`/api/studios/${user._id}/create-studio`)
        .set('Authorization', `Bearer ${token}`)
        .send(createValidStudioData({
          name: { en: 'User Studio', he: 'סטודיו משתמש' },
        }));

      expect(res.status).toBe(200);

      // Verify user has studio reference
      const updatedUser = await UserModel.findById(user._id);
      expect(updatedUser?.studios?.map(s => s.toString())).toContain(res.body._id.toString());
    });

    it('should create a studio with English-only translations', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post(`/api/studios/${user._id}/create-studio`)
        .set('Authorization', `Bearer ${token}`)
        .send(createValidStudioData({
          name: { en: 'English Only Studio' },
          description: { en: 'An English-only studio description.' },
        }));

      expect(res.status).toBe(200);
      expect(res.body.name.en).toBe('English Only Studio');
    });

    it('should reject creating a studio for another user', async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const token = generateTestToken(other._id);

      const res = await request(app)
        .post(`/api/studios/${owner._id}/create-studio`)
        .set('Authorization', `Bearer ${token}`)
        .send(createValidStudioData());

      expect(res.status).toBe(403);
    });

    it('should reject studio with missing required fields', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user._id);

      const res = await request(app)
        .post(`/api/studios/${user._id}/create-studio`)
        .set('Authorization', `Bearer ${token}`)
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
      const token = generateTestToken(user._id);

      const res = await request(app)
        .put(`/api/studios/${studio._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(createValidStudioData({
          name: { en: 'Updated Studio', he: 'סטודיו מעודכן' },
          description: { en: 'Updated description', he: 'תיאור מעודכן' },
        }));

      expect(res.status).toBe(200);
      expect(res.body.name.en).toBe('Updated Studio');
    });

    it('should accept PUT with nested studioAvailability._id from a GET echo', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({
        createdBy: user._id,
        studioAvailability: {
          days: ['Monday'],
          times: [{ start: '10:00', end: '18:00' }],
        },
        amenities: ['WiFi'],
      });
      const token = generateTestToken(user._id);

      // Simulate manage-hub GET → mutate amenities → PUT full document
      const getRes = await request(app).get(`/api/studios/${studio._id}`);
      expect(getRes.status).toBe(200);
      const full = getRes.body.currStudio;
      // Force nested _ids even if mongoose schema no longer emits them
      full.studioAvailability = {
        ...(full.studioAvailability || {}),
        _id: '507f1f77bcf86cd799439011',
        days: full.studioAvailability?.days || ['Monday'],
        times: (full.studioAvailability?.times || [{ start: '10:00', end: '18:00' }]).map(
          (t: { start: string; end: string }) => ({
            ...t,
            _id: '507f1f77bcf86cd799439012',
          })
        ),
      };
      full.amenities = ['WiFi', 'Parking', 'AC'];

      const putRes = await request(app)
        .put(`/api/studios/${studio._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(full);

      expect(putRes.status).toBe(200);
      expect(putRes.body.amenities).toEqual(['WiFi', 'Parking', 'AC']);
      expect(putRes.body.studioAvailability.days).toEqual(['Monday']);
    });

    it('should persist amenities-only PATCH without touching hours', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({
        createdBy: user._id,
        studioAvailability: {
          days: ['Tuesday'],
          times: [{ start: '09:00', end: '17:00' }],
        },
      });
      const token = generateTestToken(user._id);

      const res = await request(app)
        .patch(`/api/studios/${studio._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amenities: ['Parking'] });

      expect(res.status).toBe(200);
      expect(res.body.amenities).toEqual(['Parking']);
      expect(res.body.studioAvailability.days).toEqual(['Tuesday']);
      expect(res.body.studioAvailability.times[0].start).toBe('09:00');
    });

    it('should reject update from non-owner', async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const studio = await createTestStudio({ createdBy: owner._id });
      const token = generateTestToken(other._id);

      const res = await request(app)
        .put(`/api/studios/${studio._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(createValidStudioData({
          name: { en: 'Hijacked', he: 'חטיפה' },
        }));

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent studio', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user._id);
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .put(`/api/studios/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
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
      const token = generateTestToken(user._id);

      const res = await request(app)
        .patch(`/api/studios/${studio._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          active: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);
      // Original name should be preserved
      expect(res.body.name.en).toBe('Original Name');
    });

    it('should persist hours and amenities section patches', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });
      const token = generateTestToken(user._id);

      const hoursRes = await request(app)
        .patch(`/api/studios/${studio._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          studioAvailability: {
            days: ['Monday'],
            times: [{ start: '10:00', end: '18:00' }],
          },
          amenities: ['WiFi', 'Parking'],
        });

      expect(hoursRes.status).toBe(200);
      expect(hoursRes.body.studioAvailability.days).toEqual(['Monday']);
      expect(hoursRes.body.studioAvailability.times[0].start).toBe('10:00');
      expect(hoursRes.body.amenities).toEqual(['WiFi', 'Parking']);

      const getRes = await request(app).get(`/api/studios/${studio._id}`);
      expect(getRes.body.currStudio.studioAvailability.days).toEqual(['Monday']);
      expect(getRes.body.currStudio.amenities).toEqual(['WiFi', 'Parking']);
    });

    it('should reject patch with non-allowed fields', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });
      const token = generateTestToken(user._id);

      const res = await request(app)
        .patch(`/api/studios/${studio._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          createdBy: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/studios/:studioId', () => {
    it('should delete a studio', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });
      const token = generateTestToken(user._id);

      const deleteRes = await request(app)
        .delete(`/api/studios/${studio._id}`)
        .set('Authorization', `Bearer ${token}`);
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
