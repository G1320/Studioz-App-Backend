import * as schedule from 'node-schedule';
import { platformFeeService } from '../services/platformFeeService.js';

/**
 * Platform Fee Billing Scheduler
 *
 * Handles periodic billing of platform fees to vendors.
 *
 * Schedule:
 * - Monthly billing: 2nd of each month at 10:00 AM (gives 1 day buffer after month end)
 * - Retry failed charges: Daily at 14:00
 */
export class PlatformFeeScheduler {
  private monthlyBillingJob: schedule.Job;
  private retryJob: schedule.Job;

  constructor() {
    // Run monthly billing on the 2nd of each month at 10:00 AM
    this.monthlyBillingJob = schedule.scheduleJob('0 10 2 * *', async () => {
      console.log('[PlatformFee Scheduler] Running monthly billing...');
      try {
        const result = await platformFeeService.runMonthlyBilling();
        console.log('[PlatformFee Scheduler] Monthly billing complete:', result);
      } catch (error) {
        console.error('[PlatformFee Scheduler] Monthly billing failed:', error);
      }
    });

    // Retry failed charges daily at 14:00
    this.retryJob = schedule.scheduleJob('0 14 * * *', async () => {
      try {
        const result = await platformFeeService.retryFailedCycles();
        if (result.retried > 0) {
          console.log(`[PlatformFee Scheduler] Retry results: ${result.succeeded}/${result.retried} succeeded`);
        }
      } catch (error) {
        console.error('[PlatformFee Scheduler] Retry job failed:', error);
      }
    });

    console.log('[PlatformFee Scheduler] Initialized - billing: 2nd of month at 10AM, retries: daily at 2PM');
  }

  stop(): void {
    this.monthlyBillingJob?.cancel();
    this.retryJob?.cancel();
    console.log('[PlatformFee Scheduler] Stopped');
  }

  async runBillingNow() {
    console.log('[PlatformFee Scheduler] Manually triggering monthly billing...');
    return platformFeeService.runMonthlyBilling();
  }

  async runRetryNow() {
    console.log('[PlatformFee Scheduler] Manually triggering retry...');
    return platformFeeService.retryFailedCycles();
  }
}

let scheduler: PlatformFeeScheduler | null = null;

export const initializePlatformFeeScheduler = (): void => {
  if (!scheduler) {
    scheduler = new PlatformFeeScheduler();
  }
};

export const stopPlatformFeeScheduler = (): void => {
  if (scheduler) {
    scheduler.stop();
    scheduler = null;
  }
};

export const getPlatformFeeScheduler = (): PlatformFeeScheduler | null => {
  return scheduler;
};
