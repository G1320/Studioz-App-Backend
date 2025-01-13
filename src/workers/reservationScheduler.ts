import * as schedule from 'node-schedule';
import { updateExpiredReservations, cleanupExpiredReservations } from '../utils/reservationUtils.js';

export class ReservationScheduler {
  private expirationJob: schedule.Job;
  private cleanupJob: schedule.Job;

  constructor() {
    // Update expired reservations every minute
    this.expirationJob = schedule.scheduleJob('*/1 * * * *', async () => {
      try {
        await updateExpiredReservations();
      } catch (error) {
        console.error('Error in reservation expiration check:', error);
      }
    });

    // Clean up old expired reservations daily at midnight
    this.cleanupJob = schedule.scheduleJob('0 0 * * *', async () => {
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