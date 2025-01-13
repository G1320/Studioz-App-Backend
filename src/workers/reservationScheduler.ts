import type { Job } from 'node-schedule';
import nodeSchedule from 'node-schedule';
import { cleanupExpiredReservations, updateExpiredReservations } from '../utils/reservationUtils.js';

export class ReservationScheduler {
  private expirationJob: Job;
  private cleanupJob: Job;

  constructor() {
    // Update expired reservations every minute
    this.expirationJob = nodeSchedule.scheduleJob('*/1 * * * *', async () => {
      try {
        await updateExpiredReservations();
      } catch (error) {
        console.error('Error in reservation expiration check:', error);
      }
    });

    // Clean up old expired reservations daily at midnight
    this.cleanupJob = nodeSchedule.scheduleJob('0 0 * * *', async () => {
      try {
        await cleanupExpiredReservations();
      } catch (error) {
        console.error('Error in reservation cleanup:', error);
      }
    });
  }

  stop(): void {
    this.expirationJob?.cancel();
    this.cleanupJob?.cancel();
  }
}

let scheduler: ReservationScheduler | null = null;

export const initializeReservationScheduler = (): void => {
  if (!scheduler) {
    scheduler = new ReservationScheduler();
    console.log('Reservation scheduler initialized');
  }
};

export const stopReservationScheduler = (): void => {
  if (scheduler) {
    scheduler.stop();
    scheduler = null;
    console.log('Reservation scheduler stopped');
  }
};