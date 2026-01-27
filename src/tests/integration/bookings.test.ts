import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import {
  createTestUser,
  createTestStudio,
  createTestItem,
  getTomorrowDate,
} from '../helpers/fixtures.js';
import { ReservationModel } from '../../models/reservationModel.js';
import { ItemModel } from '../../models/itemModel.js';

describe('Bookings API', () => {
  const app = createTestApp();

  describe('POST /api/bookings/confirm', () => {
    it('should confirm pending reservations', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });
      const item = await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        studioName: studio.name,
        instantBook: false, // Creates PENDING reservation
      });

      const bookingDate = getTomorrowDate();

      // Create a pending reservation
      const reserveRes = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id,
          bookingDate,
          startTime: '10:00',
          hours: 2,
          customerId: user._id,
          customerName: 'Test Customer',
        });

      expect(reserveRes.status).toBe(200);
      const reservationId = reserveRes.body;

      // Verify reservation is pending
      const pendingRes = await ReservationModel.findById(reservationId);
      expect(pendingRes?.status).toBe('pending');

      // Confirm the reservation
      const confirmRes = await request(app)
        .post('/api/bookings/confirm')
        .send({
          reservationIds: [reservationId],
          orderId: 'order-123',
        });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.confirmedReservations).toHaveLength(1);

      // Verify reservation is confirmed
      const confirmedRes = await ReservationModel.findById(reservationId);
      expect(confirmedRes?.status).toBe('confirmed');
      expect(confirmedRes?.orderId).toBe('order-123');
    });

    it('should return 400 when no reservation IDs provided', async () => {
      const res = await request(app)
        .post('/api/bookings/confirm')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 when no pending reservations found', async () => {
      const res = await request(app)
        .post('/api/bookings/confirm')
        .send({
          reservationIds: ['507f1f77bcf86cd799439011'],
        });

      expect(res.status).toBe(404);
    });

    it('should confirm multiple reservations at once', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });
      const item = await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        studioName: studio.name,
        instantBook: false,
      });

      const bookingDate = getTomorrowDate();

      // Create two pending reservations for different times
      const res1 = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id,
          bookingDate,
          startTime: '10:00',
          hours: 1,
          customerId: user._id,
        });

      const res2 = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id,
          bookingDate,
          startTime: '14:00',
          hours: 1,
          customerId: user._id,
        });

      const confirmRes = await request(app)
        .post('/api/bookings/confirm')
        .send({
          reservationIds: [res1.body, res2.body],
        });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.confirmedReservations).toHaveLength(2);
    });
  });

  describe('DELETE /api/bookings/release-time-slots/', () => {
    it('should release time slots and cancel reservation', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });
      const item = await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        studioName: studio.name,
      });

      const bookingDate = getTomorrowDate();

      // Reserve slots first
      await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id,
          bookingDate,
          startTime: '10:00',
          hours: 2,
          customerId: user._id,
        });

      // Release the slots
      const releaseRes = await request(app)
        .delete('/api/bookings/release-time-slots/')
        .send({
          itemId: item._id,
          bookingDate,
          startTime: '10:00',
          hours: 2,
        });

      expect(releaseRes.status).toBe(200);

      // Verify slots are available again
      const updatedItem = await ItemModel.findById(item._id);
      const dateAvailability = updatedItem?.availability?.find(
        (a: { date: string }) => a.date === bookingDate
      );
      expect(dateAvailability?.times).toContain('10:00');
      expect(dateAvailability?.times).toContain('11:00');
    });
  });

  describe('Disabled item/studio handling', () => {
    it('should reject booking for disabled item', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });
      const item = await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        studioName: studio.name,
        active: false, // Disabled item
      });

      const res = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id,
          bookingDate: getTomorrowDate(),
          startTime: '10:00',
          hours: 1,
          customerId: user._id,
        });

      expect(res.status).toBe(400);
    });

    it('should reject booking for disabled studio', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({
        createdBy: user._id,
        active: false, // Disabled studio
      });
      const item = await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        studioName: studio.name,
      });

      const res = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id,
          bookingDate: getTomorrowDate(),
          startTime: '10:00',
          hours: 1,
          customerId: user._id,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Instant book vs non-instant book', () => {
    it('should create confirmed reservation for instant book item', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });
      const item = await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        studioName: studio.name,
        instantBook: true,
      });

      const res = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id,
          bookingDate: getTomorrowDate(),
          startTime: '10:00',
          hours: 1,
          customerId: user._id,
        });

      expect(res.status).toBe(200);

      const reservation = await ReservationModel.findById(res.body);
      expect(reservation?.status).toBe('confirmed');
    });

    it('should create pending reservation for non-instant book item', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });
      const item = await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        studioName: studio.name,
        instantBook: false,
      });

      const res = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id,
          bookingDate: getTomorrowDate(),
          startTime: '10:00',
          hours: 1,
          customerId: user._id,
        });

      expect(res.status).toBe(200);

      const reservation = await ReservationModel.findById(res.body);
      expect(reservation?.status).toBe('pending');
    });
  });

  describe('POST /api/bookings/reserve-studio-time-slot/', () => {
    it('should reserve slots for all items in studio', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });

      // Create multiple items for the studio
      const item1 = await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        studioName: studio.name,
      });
      const item2 = await createTestItem({
        studioId: studio._id,
        sellerId: user._id,
        studioName: studio.name,
      });

      const bookingDate = getTomorrowDate();

      const res = await request(app)
        .post('/api/bookings/reserve-studio-time-slot/')
        .send({
          studioId: studio._id,
          bookingDate,
          startTime: '10:00',
          hours: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);

      // Verify slots are blocked on both items
      const updatedItem1 = await ItemModel.findById(item1._id);
      const updatedItem2 = await ItemModel.findById(item2._id);

      const item1Availability = updatedItem1?.availability?.find(
        (a: { date: string }) => a.date === bookingDate
      );
      const item2Availability = updatedItem2?.availability?.find(
        (a: { date: string }) => a.date === bookingDate
      );

      expect(item1Availability?.times).not.toContain('10:00');
      expect(item1Availability?.times).not.toContain('11:00');
      expect(item2Availability?.times).not.toContain('10:00');
      expect(item2Availability?.times).not.toContain('11:00');
    });

    it('should return 404 when studio has no items', async () => {
      const user = await createTestUser();
      const studio = await createTestStudio({ createdBy: user._id });
      // No items created

      const res = await request(app)
        .post('/api/bookings/reserve-studio-time-slot/')
        .send({
          studioId: studio._id,
          bookingDate: getTomorrowDate(),
          startTime: '10:00',
          hours: 1,
        });

      expect(res.status).toBe(404);
    });
  });
});
