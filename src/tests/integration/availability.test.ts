import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import {
  createTestUser,
  createTestStudio,
  createTestItem,
  getTomorrowDate,
} from '../helpers/fixtures.js';
import { ItemModel } from '../../models/itemModel.js';

describe('Time Slot Availability', () => {
  const app = createTestApp();
  let testUser: any;
  let testStudio: any;

  beforeEach(async () => {
    testUser = await createTestUser();
    testStudio = await createTestStudio({ createdBy: testUser._id });
  });

  describe('Studio-wide slot blocking', () => {
    it('should block time slots for ALL items in studio when one is booked', async () => {
      const bookingDate = getTomorrowDate();

      // Create two items in the same studio
      const item1 = await createTestItem({
        studioId: testStudio._id,
        sellerId: testUser._id,
        studioName: testStudio.name,
        instantBook: true,
      });

      const item2 = await createTestItem({
        studioId: testStudio._id,
        sellerId: testUser._id,
        studioName: testStudio.name,
        instantBook: true,
      });

      // Get initial availability for item2
      const item2Before = await ItemModel.findById(item2._id);
      const initialAvailability = item2Before?.availability?.find(
        (a: any) => a.date === bookingDate
      );
      const initialSlots = initialAvailability?.times || [];

      // Book item1 at 10:00 for 2 hours
      const bookingRes = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item1._id.toString(),
          bookingDate,
          startTime: '10:00',
          hours: 2,
          customerId: testUser._id.toString(),
          customerName: 'Test Customer',
          customerPhone: '0501234567',
        });

      expect(bookingRes.status).toBe(200);

      // Verify item2's slots are also blocked (10:00 and 11:00 should be removed)
      const item2After = await ItemModel.findById(item2._id);
      const afterAvailability = item2After?.availability?.find(
        (a: any) => a.date === bookingDate
      );
      const afterSlots = afterAvailability?.times || [];

      // Item2 should NOT have 10:00 and 11:00 available anymore
      expect(afterSlots).not.toContain('10:00');
      expect(afterSlots).not.toContain('11:00');

      // But other slots should still be available
      expect(afterSlots).toContain('12:00');
      expect(afterSlots).toContain('14:00');
    });

    it('should release slots for ALL items in studio when booking is cancelled', async () => {
      const bookingDate = getTomorrowDate();

      // Create two items in the same studio
      const item1 = await createTestItem({
        studioId: testStudio._id,
        sellerId: testUser._id,
        studioName: testStudio.name,
        instantBook: true,
      });

      const item2 = await createTestItem({
        studioId: testStudio._id,
        sellerId: testUser._id,
        studioName: testStudio.name,
        instantBook: true,
      });

      // Book item1
      const bookingRes = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item1._id.toString(),
          bookingDate,
          startTime: '14:00',
          hours: 1,
          customerId: testUser._id.toString(),
          customerName: 'Test Customer',
          customerPhone: '0501234567',
        });

      const reservationId = bookingRes.body;

      // Verify slots are blocked on item2
      const item2AfterBooking = await ItemModel.findById(item2._id);
      const blockedAvail = item2AfterBooking?.availability?.find(
        (a: any) => a.date === bookingDate
      );
      expect(blockedAvail?.times).not.toContain('14:00');

      // Cancel the reservation
      const cancelRes = await request(app)
        .patch(`/api/reservations/${reservationId}/cancel`);

      expect(cancelRes.status).toBe(200);

      // Verify slots are released on item2
      const item2AfterCancel = await ItemModel.findById(item2._id);
      const releasedAvail = item2AfterCancel?.availability?.find(
        (a: any) => a.date === bookingDate
      );
      expect(releasedAvail?.times).toContain('14:00');
    });

    it('should not affect items in different studios', async () => {
      const bookingDate = getTomorrowDate();

      // Create an item in the test studio
      const item1 = await createTestItem({
        studioId: testStudio._id,
        sellerId: testUser._id,
        studioName: testStudio.name,
        instantBook: true,
      });

      // Create a different studio and item
      const otherStudio = await createTestStudio({ createdBy: testUser._id });
      const item2 = await createTestItem({
        studioId: otherStudio._id,
        sellerId: testUser._id,
        studioName: otherStudio.name,
        instantBook: true,
      });

      // Book item1
      await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item1._id.toString(),
          bookingDate,
          startTime: '10:00',
          hours: 2,
          customerId: testUser._id.toString(),
          customerName: 'Test Customer',
          customerPhone: '0501234567',
        });

      // Item2 (different studio) should still have the slots available
      const item2After = await ItemModel.findById(item2._id);
      const item2Avail = item2After?.availability?.find(
        (a: any) => a.date === bookingDate
      );

      expect(item2Avail?.times).toContain('10:00');
      expect(item2Avail?.times).toContain('11:00');
    });
  });

  describe('Consecutive booking validation', () => {
    it('should allow booking non-overlapping time slots on same item', async () => {
      const bookingDate = getTomorrowDate();

      const item = await createTestItem({
        studioId: testStudio._id,
        sellerId: testUser._id,
        studioName: testStudio.name,
        instantBook: true,
      });

      // First booking: 10:00-11:00
      const booking1 = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id.toString(),
          bookingDate,
          startTime: '10:00',
          hours: 1,
          customerId: testUser._id.toString(),
          customerName: 'Customer 1',
          customerPhone: '0501234567',
        });

      expect(booking1.status).toBe(200);

      // Second booking: 14:00-16:00 (non-overlapping)
      const booking2 = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id.toString(),
          bookingDate,
          startTime: '14:00',
          hours: 2,
          customerId: testUser._id.toString(),
          customerName: 'Customer 2',
          customerPhone: '0509876543',
        });

      expect(booking2.status).toBe(200);
    });

    it('should reject booking that overlaps with existing booking', async () => {
      const bookingDate = getTomorrowDate();

      const item = await createTestItem({
        studioId: testStudio._id,
        sellerId: testUser._id,
        studioName: testStudio.name,
        instantBook: true,
      });

      // First booking: 10:00-12:00
      await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id.toString(),
          bookingDate,
          startTime: '10:00',
          hours: 2,
          customerId: testUser._id.toString(),
          customerName: 'Customer 1',
          customerPhone: '0501234567',
        });

      // Try to book 11:00-13:00 (overlaps with 11:00 from first booking)
      const overlapRes = await request(app)
        .post('/api/bookings/reserve-time-slots/')
        .send({
          itemId: item._id.toString(),
          bookingDate,
          startTime: '11:00',
          hours: 2,
          customerId: testUser._id.toString(),
          customerName: 'Customer 2',
          customerPhone: '0509876543',
        });

      expect(overlapRes.status).toBe(400);
      expect(overlapRes.text).toContain('not available');
    });
  });
});
