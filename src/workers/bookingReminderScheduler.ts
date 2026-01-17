import * as schedule from 'node-schedule';
import { sendBookingReminders, resetPastReminderFlags } from '../services/bookingReminderService.js';

/**
 * Booking Reminder Scheduler
 *
 * Sends reminder emails to customers before their booked sessions.
 *
 * Schedule:
 * - 24-hour reminders: Runs at 10:00 AM daily
 * - 2-hour reminders: Runs every hour for same-day bookings
 * - Cleanup: Runs daily at midnight to reset old reminder flags
 */
export class BookingReminderScheduler {
  private dailyReminderJob: schedule.Job;
  private hourlyReminderJob: schedule.Job;
  private cleanupJob: schedule.Job;

  constructor() {
    // Send 24-hour reminders at 10:00 AM daily
    // This catches bookings happening the next day
    this.dailyReminderJob = schedule.scheduleJob('0 10 * * *', async () => {
      console.log('Running daily booking reminder job (24-hour reminders)...');
      try {
        const count = await sendBookingReminders(24);
        console.log(`Daily reminder job completed: sent ${count} reminders`);
      } catch (error) {
        console.error('Error in daily booking reminder job:', error);
      }
    });

    // Send same-day reminders every hour (for bookings in the next 2 hours)
    // This provides a last-minute reminder
    this.hourlyReminderJob = schedule.scheduleJob('0 * * * *', async () => {
      console.log('Running hourly booking reminder job (2-hour reminders)...');
      try {
        const count = await sendBookingReminders(2);
        console.log(`Hourly reminder job completed: sent ${count} reminders`);
      } catch (error) {
        console.error('Error in hourly booking reminder job:', error);
      }
    });

    // Clean up old reminder flags at midnight
    // This allows rescheduled bookings to receive new reminders
    this.cleanupJob = schedule.scheduleJob('0 0 * * *', async () => {
      console.log('Running reminder cleanup job...');
      try {
        await resetPastReminderFlags();
        console.log('Reminder cleanup job completed');
      } catch (error) {
        console.error('Error in reminder cleanup job:', error);
      }
    });

    console.log('Booking reminder scheduler initialized with:');
    console.log('  - Daily 24-hour reminders at 10:00 AM');
    console.log('  - Hourly 2-hour reminders');
    console.log('  - Nightly cleanup at midnight');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    this.dailyReminderJob?.cancel();
    this.hourlyReminderJob?.cancel();
    this.cleanupJob?.cancel();
  }

  /**
   * Manually trigger the 24-hour reminder job (for testing/admin use)
   */
  async runDailyRemindersNow(): Promise<number> {
    console.log('Manually triggering daily reminder job...');
    return sendBookingReminders(24);
  }

  /**
   * Manually trigger the 2-hour reminder job (for testing/admin use)
   */
  async runHourlyRemindersNow(): Promise<number> {
    console.log('Manually triggering hourly reminder job...');
    return sendBookingReminders(2);
  }
}

// Singleton instance
let scheduler: BookingReminderScheduler | null = null;

/**
 * Initialize the booking reminder scheduler
 */
export const initializeBookingReminderScheduler = (): void => {
  if (!scheduler) {
    scheduler = new BookingReminderScheduler();
    console.log('Booking reminder scheduler initialized');
  }
};

/**
 * Stop the booking reminder scheduler
 */
export const stopBookingReminderScheduler = (): void => {
  if (scheduler) {
    scheduler.stop();
    scheduler = null;
    console.log('Booking reminder scheduler stopped');
  }
};

/**
 * Get the scheduler instance (for manual triggering)
 */
export const getBookingReminderScheduler = (): BookingReminderScheduler | null => {
  return scheduler;
};
