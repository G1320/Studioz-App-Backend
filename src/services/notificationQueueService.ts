/**
 * Lightweight in-memory notification dispatch queue.
 * Handles email and push delivery with retries and exponential backoff.
 * Failed deliveries after max retries are persisted for manual review.
 */

import { sendPushToUser } from './webPushService.js';
import mongoose from 'mongoose';

// ==========================================
// Dead-letter schema (failed notifications)
// ==========================================

const failedNotificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    notificationId: { type: String },
    channel: { type: String, enum: ['email', 'push'], required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

failedNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 days

export const FailedNotificationModel = mongoose.model('FailedNotification', failedNotificationSchema);

// ==========================================
// Queue types
// ==========================================

interface QueueJob {
  id: string;
  userId: string;
  notificationId?: string;
  channel: 'email' | 'push';
  payload: any;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: number;
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000; // 2 seconds
const MAX_CONCURRENT = 5;

// ==========================================
// Queue implementation
// ==========================================

const queue: QueueJob[] = [];
let processing = false;
let activeCount = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Enqueue a push notification for delivery with retry.
 */
export const enqueuePush = (
  userId: string,
  payload: { title: string; body: string; icon?: string; actionUrl?: string },
  notificationId?: string
) => {
  queue.push({
    id: generateId(),
    userId,
    notificationId,
    channel: 'push',
    payload,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    nextAttemptAt: Date.now(),
  });
  scheduleProcessing();
};

/**
 * Enqueue an email notification for delivery with retry.
 */
export const enqueueEmail = (
  userId: string,
  payload: { sendFn: () => Promise<void> },
  notificationId?: string
) => {
  queue.push({
    id: generateId(),
    userId,
    notificationId,
    channel: 'email',
    payload,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    nextAttemptAt: Date.now(),
  });
  scheduleProcessing();
};

function scheduleProcessing() {
  if (timer || processing) return;
  timer = setTimeout(() => {
    timer = null;
    processQueue();
  }, 100);
}

async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    while (queue.length > 0 && activeCount < MAX_CONCURRENT) {
      const now = Date.now();
      const readyIndex = queue.findIndex((job) => job.nextAttemptAt <= now);
      if (readyIndex === -1) {
        // All remaining jobs are delayed - schedule next check
        const nextTime = Math.min(...queue.map((j) => j.nextAttemptAt));
        const delay = Math.max(nextTime - now, 100);
        timer = setTimeout(() => {
          timer = null;
          processQueue();
        }, delay);
        break;
      }

      const job = queue.splice(readyIndex, 1)[0];
      activeCount++;
      processJob(job).finally(() => {
        activeCount--;
        if (queue.length > 0) scheduleProcessing();
      });
    }
  } finally {
    processing = false;
  }
}

async function processJob(job: QueueJob) {
  job.attempts++;
  try {
    if (job.channel === 'push') {
      await sendPushToUser(job.userId, job.payload);
    } else if (job.channel === 'email') {
      await job.payload.sendFn();
    }
  } catch (error: any) {
    const errorMsg = error?.message || String(error);

    if (job.attempts < job.maxAttempts) {
      // Exponential backoff: 2s, 4s, 8s
      const delay = BASE_DELAY_MS * Math.pow(2, job.attempts - 1);
      job.nextAttemptAt = Date.now() + delay;
      queue.push(job);
      console.warn(
        `[NotifQueue] ${job.channel} delivery failed (attempt ${job.attempts}/${job.maxAttempts}), retrying in ${delay}ms:`,
        errorMsg
      );
    } else {
      // Max retries exhausted - persist to dead-letter
      console.error(
        `[NotifQueue] ${job.channel} delivery failed after ${job.maxAttempts} attempts for user ${job.userId}:`,
        errorMsg
      );
      try {
        await FailedNotificationModel.create({
          userId: job.userId,
          notificationId: job.notificationId,
          channel: job.channel,
          payload: job.channel === 'push' ? job.payload : { type: 'email' },
          error: errorMsg,
          attempts: job.attempts,
        });
      } catch (dbErr) {
        console.error('[NotifQueue] Failed to persist dead-letter:', dbErr);
      }
    }
  }
}

/**
 * Get current queue length (for monitoring).
 */
export const getQueueLength = () => queue.length;

/**
 * Drain the queue (for graceful shutdown).
 */
export const drainQueue = async (timeoutMs = 5000): Promise<void> => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0 && activeCount === 0) return;

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if ((queue.length === 0 && activeCount === 0) || Date.now() > deadline) {
        resolve();
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });
};
