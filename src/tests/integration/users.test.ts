import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import {
  createTestUser,
  createTestStudio,
  createTestUserWithSubscription,
} from '../helpers/fixtures.js';
import { UserModel } from '../../models/userModel.js';

describe('Users API', () => {
  const app = createTestApp();

  describe('GET /api/users', () => {
    it('should return paginated users list', async () => {
      await createTestUser();
      await createTestUser();
      await createTestUser();

      const res = await request(app).get('/api/users');

      expect(res.status).toBe(200);
      expect(res.body.users).toBeDefined();
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
    });

    it('should support pagination parameters', async () => {
      // Create 5 users
      for (let i = 0; i < 5; i++) {
        await createTestUser();
      }

      const res = await request(app).get('/api/users?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.users.length).toBe(2);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('should return 404 when no users exist', async () => {
      const res = await request(app).get('/api/users');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/users/:sub', () => {
    it('should return user by Auth0 sub', async () => {
      const user = await createTestUser({ sub: 'auth0|test123456789' });

      const res = await request(app).get(`/api/users/${user.sub}`);

      expect(res.status).toBe(200);
      expect(res.body.sub).toBe('auth0|test123456789');
    });

    it('should return null for non-existent sub', async () => {
      const res = await request(app).get('/api/users/auth0|nonexistent');

      expect(res.status).toBe(204);
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({
          username: 'newuser123',
          name: 'New User',
          email: 'newuser@example.com',
          sub: 'auth0|newuser123',
        });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('newuser123');
      expect(res.body.name).toBe('New User');
    });

    it('should reject duplicate username', async () => {
      await createTestUser({ username: 'existinguser' });

      const res = await request(app)
        .post('/api/users')
        .send({
          username: 'existinguser',
          name: 'Another User',
          email: 'another@example.com',
        });

      expect(res.status).toBe(500); // Throws error for duplicate
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user details', async () => {
      const user = await createTestUser({ name: 'Original Name' });

      const res = await request(app)
        .put(`/api/users/${user._id}`)
        .send({
          name: 'Updated Name',
          phone: '+1234567890',
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.phone).toBe('+1234567890');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .put(`/api/users/${fakeId}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(404);
    });

    it('should update user role', async () => {
      const user = await createTestUser({ role: 'user' });

      const res = await request(app)
        .put(`/api/users/${user._id}`)
        .send({ role: 'vendor' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('vendor');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete a user', async () => {
      const user = await createTestUser();

      const deleteRes = await request(app).delete(`/api/users/${user._id}`);
      expect(deleteRes.status).toBe(204);

      // Verify user is deleted
      const deletedUser = await UserModel.findById(user._id);
      expect(deletedUser).toBeNull();
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app).delete(`/api/users/${fakeId}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/users/my-studios/:id', () => {
    it('should return user studios', async () => {
      const user = await createTestUser();
      const studio1 = await createTestStudio({ createdBy: user._id });
      const studio2 = await createTestStudio({ createdBy: user._id });

      // Add studios to user
      await UserModel.findByIdAndUpdate(user._id, {
        studios: [studio1._id, studio2._id],
      });

      const res = await request(app).get(`/api/users/my-studios/${user._id}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app).get(`/api/users/my-studios/${fakeId}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/users/:id/add-studio/:studioId', () => {
    it('should add studio to user', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });

      const res = await request(app)
        .post(`/api/users/${user._id}/add-studio/${studio._id}`);

      expect(res.status).toBe(200);

      // Verify studio was added
      const updatedUser = await UserModel.findById(user._id);
      expect(updatedUser?.studios?.map(s => s.toString())).toContain(studio._id.toString());
    });

    it('should not add duplicate studio', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });

      // Add studio first time
      await request(app).post(`/api/users/${user._id}/add-studio/${studio._id}`);

      // Try to add again
      const res = await request(app)
        .post(`/api/users/${user._id}/add-studio/${studio._id}`);

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = '507f1f77bcf86cd799439011';
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });

      const res = await request(app)
        .post(`/api/users/${fakeUserId}/add-studio/${studio._id}`);

      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent studio', async () => {
      const user = await createTestUser();
      const fakeStudioId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .post(`/api/users/${user._id}/add-studio/${fakeStudioId}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/users/:id/remove-studio/:studioId', () => {
    it('should remove studio from user', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });

      // Add studio first
      await UserModel.findByIdAndUpdate(user._id, {
        $push: { studios: studio._id },
      });

      const res = await request(app)
        .post(`/api/users/${user._id}/remove-studio/${studio._id}`);

      expect(res.status).toBe(200);

      // Verify studio was removed
      const updatedUser = await UserModel.findById(user._id);
      expect(updatedUser?.studios?.map(s => s.toString())).not.toContain(studio._id.toString());
    });
  });

  describe('GET /api/users/:id/saved-cards', () => {
    it('should return empty array when no saved cards', async () => {
      const user = await createTestUser();

      const res = await request(app).get(`/api/users/${user._id}/saved-cards`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });
});
