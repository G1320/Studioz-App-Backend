import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import {
  createTestUser,
  createTestStudio,
  createTestItem,
  getTomorrowDate,
} from '../helpers/fixtures.js';

describe('Reservations API', () => {
  const app = createTestApp();
  let testUser: any;
  let testStudio: any;
  let testItem: any;

  beforeEach(async () => {
    // Create test data
    testUser = await createTestUser();
    testStudio = await createTestStudio({ createdBy: testUser._id });
    testItem = await createTestItem({
      studioId: testStudio._id,
      sellerId: testUser._id,
      studioName: testStudio.name,
      instantBook: true,
    });
  });

  describe('POST /api/bookings/reserve-time-slots (Create Reservation)', () => {
    it('should create a reservation and block time slots', async () => {
      const bookingDate = getTomorrowDate();

      // Booking endpoint returns just the reservation ID
      const res = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: testItem._id.toString(),
          bookingDate,
          startTime: '10:00',
          hours: 2,
          customerId: testUser._id.toString(),
          customerName: 'Test Customer',
          customerPhone: '0501234567',
        });

      expect(res.status).toBe(200);
      // Response is just the ObjectId string
      const reservationId = res.body;
      expect(reservationId).toBeTruthy();

      // Fetch the full reservation to verify contents
      const getRes = await request(app)
        .get(`/api/reservations/${reservationId}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.status).toBe('confirmed'); // instantBook is true
      expect(getRes.body.bookingDate).toBe(bookingDate);
      expect(getRes.body.timeSlots).toEqual(['10:00', '11:00']);
    });

    it('should set status to pending when instantBook is false', async () => {
      // Create a non-instant-book item
      const nonInstantItem = await createTestItem({
        studioId: testStudio._id,
        sellerId: testUser._id,
        studioName: testStudio.name,
        instantBook: false,
      });

      const res = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: nonInstantItem._id.toString(),
          bookingDate: getTomorrowDate(),
          startTime: '10:00',
          hours: 1,
          customerId: testUser._id.toString(),
          customerName: 'Test Customer',
          customerPhone: '0501234567',
        });

      expect(res.status).toBe(200);
      const reservationId = res.body;

      // Fetch to verify status
      const getRes = await request(app)
        .get(`/api/reservations/${reservationId}`);

      expect(getRes.body.status).toBe('pending');
    });

    it('should return 404 when item does not exist', async () => {
      const fakeItemId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: fakeItemId,
          bookingDate: getTomorrowDate(),
          startTime: '10:00',
          hours: 1,
          customerId: testUser._id.toString(),
        });

      expect(res.status).toBe(404);
    });

    it('should prevent double-booking the same time slot', async () => {
      const bookingDate = getTomorrowDate();

      // First booking succeeds
      const firstRes = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: testItem._id.toString(),
          bookingDate,
          startTime: '10:00',
          hours: 1,
          customerId: testUser._id.toString(),
          customerName: 'Customer 1',
          customerPhone: '0501234567',
        });

      expect(firstRes.status).toBe(200);

      // Second booking for the same slot fails
      const secondRes = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: testItem._id.toString(),
          bookingDate,
          startTime: '10:00',
          hours: 1,
          customerId: testUser._id.toString(),
          customerName: 'Customer 2',
          customerPhone: '0509876543',
        });

      expect(secondRes.status).toBe(400);
      // Error handler sends message as plain text via res.send()
      expect(secondRes.text).toContain('not available');
    });
  });

  describe('GET /api/reservations', () => {
    it('should return empty array when no reservations exist', async () => {
      const res = await request(app)
        .get('/api/reservations');

      expect(res.status).toBe(200);
      expect(res.body.reservations).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('should return reservations filtered by studioId', async () => {
      // First create a reservation via booking endpoint
      await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: testItem._id.toString(),
          bookingDate: getTomorrowDate(),
          startTime: '10:00',
          hours: 1,
          customerId: testUser._id.toString(),
          customerName: 'Test Customer',
          customerPhone: '0501234567',
        });

      // Then get reservations
      const res = await request(app)
        .get(`/api/reservations?studioId=${testStudio._id}`);

      expect(res.status).toBe(200);
      expect(res.body.reservations.length).toBe(1);
      expect(res.body.reservations[0].studioId).toBe(testStudio._id.toString());
    });
  });

  describe('GET /api/reservations/:reservationId', () => {
    it('should return a single reservation by ID', async () => {
      // Create a reservation first via booking endpoint
      const createRes = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: testItem._id.toString(),
          bookingDate: getTomorrowDate(),
          startTime: '10:00',
          hours: 1,
          customerId: testUser._id.toString(),
          customerName: 'Test Customer',
          customerPhone: '0501234567',
        });

      const reservationId = createRes.body;

      // Get the reservation
      const res = await request(app)
        .get(`/api/reservations/${reservationId}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(reservationId);
    });

    it('should return 404 for non-existent reservation', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .get(`/api/reservations/${fakeId}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/reservations/:reservationId/cancel', () => {
    it('should cancel a reservation and release time slots', async () => {
      const bookingDate = getTomorrowDate();

      // Create a reservation first via booking endpoint
      const createRes = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: testItem._id.toString(),
          bookingDate,
          startTime: '10:00',
          hours: 1,
          customerId: testUser._id.toString(),
          customerName: 'Test Customer',
          customerPhone: '0501234567',
        });

      const reservationId = createRes.body;

      // Cancel the reservation
      const cancelRes = await request(app)
        .patch(`/api/reservations/${reservationId}/cancel`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('cancelled');

      // Verify the time slot is available again - can book the same slot
      const rebookRes = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: testItem._id.toString(),
          bookingDate,
          startTime: '10:00',
          hours: 1,
          customerId: testUser._id.toString(),
          customerName: 'New Customer',
          customerPhone: '0501234567',
        });

      expect(rebookRes.status).toBe(200);
    });
  });
});
