import * as schedule from 'node-schedule';
import { paymentCanaryService } from '../services/paymentCanaryService.js';

/**
 * Payment Canary Scheduler
 *
 * Runs a real charge + refund test every hour to verify the
 * Sumit payment integration is healthy. Sends an email alert on failure.
 *
 * Schedule: every hour (on the hour)
 */
export class PaymentCanaryScheduler {
  private canaryJob: schedule.Job;

  constructor() {
    // Run every hour on the hour
    this.canaryJob = schedule.scheduleJob('0 * * * *', async () => {
      console.log('[Payment Canary] Running scheduled canary test...');
      try {
        const result = await paymentCanaryService.runCanaryTest();
        console.log(`[Payment Canary] Scheduled test complete — status: ${result.status}`);
      } catch (error) {
        console.error('[Payment Canary] Scheduled test crashed:', error);
      }
    });

    console.log('[Payment Canary] Initialized — runs every hour');
  }

  stop(): void {
    this.canaryJob?.cancel();
    console.log('[Payment Canary] Stopped');
  }

  async runNow() {
    console.log('[Payment Canary] Manually triggering canary test...');
    return paymentCanaryService.runCanaryTest();
  }
}

let scheduler: PaymentCanaryScheduler | null = null;

export const initializePaymentCanaryScheduler = (): void => {
  if (!scheduler) {
    scheduler = new PaymentCanaryScheduler();
  }
};

export const stopPaymentCanaryScheduler = (): void => {
  if (scheduler) {
    scheduler.stop();
    scheduler = null;
  }
};

export const getPaymentCanaryScheduler = (): PaymentCanaryScheduler | null => {
  return scheduler;
};
