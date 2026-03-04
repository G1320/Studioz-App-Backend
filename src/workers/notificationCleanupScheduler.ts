import * as schedule from 'node-schedule';
import { NotificationModel } from '../models/notificationModel.js';

const NOTIFICATION_TTL_DAYS = 90;

/**
 * Notification Cleanup Scheduler
 *
 * Deletes notifications older than 90 days.
 * Runs daily at 3:00 AM to avoid peak hours.
 */
export class NotificationCleanupScheduler {
  private cleanupJob: schedule.Job;

  constructor() {
    this.cleanupJob = schedule.scheduleJob('0 3 * * *', async () => {
      console.log('Running notification cleanup job...');
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - NOTIFICATION_TTL_DAYS);

        const result = await NotificationModel.deleteMany({
          createdAt: { $lt: cutoffDate }
        });

        console.log(`Notification cleanup completed: deleted ${result.deletedCount} old notifications`);
      } catch (error) {
        console.error('Error in notification cleanup job:', error);
      }
    });

    console.log(`Notification cleanup scheduler initialized (${NOTIFICATION_TTL_DAYS}-day TTL, runs daily at 3:00 AM)`);
  }

  stop(): void {
    this.cleanupJob?.cancel();
  }

  async runNow(): Promise<number> {
    console.log('Manually triggering notification cleanup...');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - NOTIFICATION_TTL_DAYS);

    const result = await NotificationModel.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    return result.deletedCount;
  }
}

let scheduler: NotificationCleanupScheduler | null = null;

export const initializeNotificationCleanupScheduler = (): void => {
  if (!scheduler) {
    scheduler = new NotificationCleanupScheduler();
  }
};

export const stopNotificationCleanupScheduler = (): void => {
  if (scheduler) {
    scheduler.stop();
    scheduler = null;
    console.log('Notification cleanup scheduler stopped');
  }
};
