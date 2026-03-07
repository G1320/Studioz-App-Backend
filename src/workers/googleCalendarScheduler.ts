import * as schedule from 'node-schedule';
import { syncAllConnectedCalendars, SyncAllResult, renewExpiringWatchChannels, setupMissingWatchChannels } from '../services/googleCalendarService.js';

/**
 * Google Calendar Sync Scheduler
 *
 * Automatically syncs Google Calendar events for all connected users.
 * This enables true 2-way sync by:
 * 1. Real-time push notifications via Google Calendar webhooks
 * 2. Polling every 10 minutes as a fallback (catches anything webhooks miss)
 * 3. Renewing watch channels daily before they expire
 *
 * Schedule:
 * - Sync job: Runs every 10 minutes (fallback polling)
 * - Watch renewal job: Runs daily at 3:00 AM to renew expiring channels
 */
export class GoogleCalendarScheduler {
  private syncJob: schedule.Job;
  private watchRenewalJob: schedule.Job;

  constructor() {
    // Sync all connected calendars every 10 minutes (fallback for webhooks)
    this.syncJob = schedule.scheduleJob('*/10 * * * *', async () => {
      console.log('[GoogleCalendarSync] Starting scheduled sync...');
      try {
        const result = await syncAllConnectedCalendars();
        console.log(`[GoogleCalendarSync] Completed: ${result.synced} synced, ${result.failed} failed`);
        if (result.errors.length > 0) {
          console.log('[GoogleCalendarSync] Errors:', result.errors);
          // Notify affected users about sync failures
          try {
            const { createAndEmitNotification } = await import('../utils/notificationUtils.js');
            for (const err of result.errors) {
              await createAndEmitNotification(
                err.userId,
                'calendar_sync_error',
                'Calendar sync failed',
                `Google Calendar sync encountered an error: ${err.error}. Please reconnect your calendar if the issue persists.`,
                { userId: err.userId },
                '/settings/integrations'
              );
            }
          } catch (notifErr) {
            console.error('[GoogleCalendarSync] Failed to send sync error notifications:', notifErr);
          }
        }
      } catch (error) {
        console.error('[GoogleCalendarSync] Job failed:', error);
      }
    });

    // Renew expiring watch channels daily at 3:00 AM and setup any missing ones
    this.watchRenewalJob = schedule.scheduleJob('0 3 * * *', async () => {
      console.log('[GoogleCalendarSync] Starting watch channel renewal...');
      try {
        const renewResult = await renewExpiringWatchChannels();
        console.log(`[GoogleCalendarSync] Watch renewal: ${renewResult.renewed} renewed, ${renewResult.failed} failed`);

        const setupResult = await setupMissingWatchChannels();
        if (setupResult.setup > 0 || setupResult.failed > 0) {
          console.log(`[GoogleCalendarSync] Watch setup: ${setupResult.setup} set up, ${setupResult.failed} failed`);
        }
      } catch (error) {
        console.error('[GoogleCalendarSync] Watch renewal job failed:', error);
      }
    });

    // On startup, set up missing watch channels (after a short delay to let DB connect)
    setTimeout(async () => {
      try {
        const result = await setupMissingWatchChannels();
        if (result.setup > 0 || result.failed > 0) {
          console.log(`[GoogleCalendarSync] Initial watch setup: ${result.setup} set up, ${result.failed} failed`);
        }
      } catch (error) {
        console.error('[GoogleCalendarSync] Initial watch setup failed:', error);
      }
    }, 10000); // 10 second delay

    console.log('[GoogleCalendarSync] Scheduler initialized (sync every 10 min, watch renewal daily at 3 AM)');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    this.syncJob?.cancel();
    this.watchRenewalJob?.cancel();
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
