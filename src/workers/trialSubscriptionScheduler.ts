import * as schedule from 'node-schedule';
import { processExpiringTrials, sendTrialEndingReminders } from '../services/trialSubscriptionService.js';

export class TrialSubscriptionScheduler {
  private chargeTrialsJob: schedule.Job;
  private reminderJob: schedule.Job;

  constructor() {
    // Process expired trials every hour
    // Checks for trials that have ended and charges them
    this.chargeTrialsJob = schedule.scheduleJob('0 * * * *', async () => {
      try {
        console.log('[Trial Scheduler] Running trial charge check...');
        const result = await processExpiringTrials();
        console.log('[Trial Scheduler] Trial charge complete:', result);
      } catch (error) {
        console.error('[Trial Scheduler] Error processing trial charges:', error);
      }
    });

    // Send trial ending reminders daily at 10am
    // Sends emails to users whose trial ends in 1 day or 3 days
    this.reminderJob = schedule.scheduleJob('0 10 * * *', async () => {
      try {
        console.log('[Trial Scheduler] Running trial reminder check...');
        const result = await sendTrialEndingReminders();
        console.log('[Trial Scheduler] Reminders sent:', result);
      } catch (error) {
        console.error('[Trial Scheduler] Error sending trial reminders:', error);
      }
    });

    console.log('[Trial Scheduler] Initialized - charge job: hourly, reminder job: daily at 10am');
  }

  stop(): void {
    this.chargeTrialsJob?.cancel();
    this.reminderJob?.cancel();
    console.log('[Trial Scheduler] Stopped');
  }

  // Manual trigger for testing or immediate processing
  async runChargeNow(): Promise<any> {
    return processExpiringTrials();
  }

  async runRemindersNow(): Promise<any> {
    return sendTrialEndingReminders();
  }
}

let scheduler: TrialSubscriptionScheduler | null = null;

export const initializeTrialScheduler = (): void => {
  if (!scheduler) {
    scheduler = new TrialSubscriptionScheduler();
  }
};

export const stopTrialScheduler = (): void => {
  if (scheduler) {
    scheduler.stop();
    scheduler = null;
  }
};

export const getTrialScheduler = (): TrialSubscriptionScheduler | null => {
  return scheduler;
};
