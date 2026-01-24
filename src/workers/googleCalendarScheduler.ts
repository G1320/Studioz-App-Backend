import * as schedule from 'node-schedule';
import { syncAllConnectedCalendars, SyncAllResult } from '../services/googleCalendarService.js';

/**
 * Google Calendar Sync Scheduler
 *
 * Automatically syncs Google Calendar events for all connected users.
 * This enables true 2-way sync by pulling external calendar events
 * and blocking corresponding time slots in the app.
 *
 * Schedule:
 * - Sync job: Runs every 10 minutes
 */
export class GoogleCalendarScheduler {
  private syncJob: schedule.Job;

  constructor() {
    // Sync all connected calendars every 10 minutes
    this.syncJob = schedule.scheduleJob('*/10 * * * *', async () => {
      console.log('[GoogleCalendarSync] Starting scheduled sync...');
      try {
        const result = await syncAllConnectedCalendars();
        console.log(`[GoogleCalendarSync] Completed: ${result.synced} synced, ${result.failed} failed`);
        if (result.errors.length > 0) {
          console.log('[GoogleCalendarSync] Errors:', result.errors);
        }
      } catch (error) {
        console.error('[GoogleCalendarSync] Job failed:', error);
      }
    });

    console.log('[GoogleCalendarSync] Scheduler initialized (every 10 minutes)');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    this.syncJob?.cancel();
  }

  /**
   * Manually trigger the sync job (for testing/admin use)
   */
  async runSyncNow(): Promise<SyncAllResult> {
    console.log('[GoogleCalendarSync] Manually triggering sync...');
    return syncAllConnectedCalendars();
  }
}

// Singleton instance
let scheduler: GoogleCalendarScheduler | null = null;

/**
 * Initialize the Google Calendar sync scheduler
 */
export const initializeGoogleCalendarScheduler = (): void => {
  if (!scheduler) {
    scheduler = new GoogleCalendarScheduler();
  }
};

/**
 * Stop the Google Calendar sync scheduler
 */
export const stopGoogleCalendarScheduler = (): void => {
  if (scheduler) {
    scheduler.stop();
    scheduler = null;
    console.log('[GoogleCalendarSync] Scheduler stopped');
  }
};

/**
 * Get the scheduler instance (for manual triggering)
 */
export const getGoogleCalendarScheduler = (): GoogleCalendarScheduler | null => {
  return scheduler;
};
