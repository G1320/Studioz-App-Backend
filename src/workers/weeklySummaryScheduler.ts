import * as schedule from 'node-schedule';
import { StudioModel } from '../models/studioModel.js';
import { ReservationModel } from '../models/reservationModel.js';
import { createAndEmitNotification } from '../utils/notificationUtils.js';

/**
 * Weekly Summary Scheduler
 *
 * Sends a weekly summary notification to each vendor with their studio performance.
 * Runs every Sunday at 10:00 AM.
 */
export class WeeklySummaryScheduler {
  private weeklyJob: schedule.Job;

  constructor() {
    // Every Sunday at 10:00 AM
    this.weeklyJob = schedule.scheduleJob('0 10 * * 0', async () => {
      console.log('[WeeklySummary] Running weekly summary job...');
      try {
        await this.generateSummaries();
      } catch (error) {
        console.error('[WeeklySummary] Job failed:', error);
      }
    });

    console.log('[WeeklySummary] Scheduler initialized (runs Sundays at 10:00 AM)');
  }

  async generateSummaries(): Promise<number> {
    // Get date range for past week
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Find all studios and their owners
    const studios = await StudioModel.find({ active: true }).select('createdBy name');

    // Group studios by owner
    const ownerStudios = new Map<string, { studioIds: string[]; studioNames: string[] }>();
    for (const studio of studios) {
      if (!studio.createdBy) continue;
      const ownerId = studio.createdBy.toString();
      if (!ownerStudios.has(ownerId)) {
        ownerStudios.set(ownerId, { studioIds: [], studioNames: [] });
      }
      const entry = ownerStudios.get(ownerId)!;
      entry.studioIds.push(studio._id.toString());
      entry.studioNames.push(studio.name?.en || studio.name?.he || 'Studio');
    }

    let sentCount = 0;

    for (const [ownerId, { studioIds, studioNames }] of ownerStudios) {
      try {
        // Count confirmed reservations for this vendor's studios in the past week
        const bookingCount = await ReservationModel.countDocuments({
          studioId: { $in: studioIds },
          status: { $in: ['confirmed', 'pending'] },
          createdAt: { $gte: weekAgo, $lte: now }
        });

        const studioLabel = studioNames.length === 1 ? studioNames[0] : `${studioNames.length} studios`;
        const message = bookingCount > 0
          ? `You had ${bookingCount} new booking${bookingCount > 1 ? 's' : ''} across ${studioLabel} this week.`
          : `No new bookings this week for ${studioLabel}. Consider updating your availability or promotions.`;

        await createAndEmitNotification(
          ownerId,
          'weekly_summary',
          'Weekly summary',
          message,
          { bookingCount, studioCount: studioIds.length },
          '/dashboard'
        );

        sentCount++;
      } catch (error) {
        console.error(`[WeeklySummary] Error generating summary for vendor ${ownerId}:`, error);
      }
    }

    console.log(`[WeeklySummary] Sent ${sentCount} weekly summaries`);
    return sentCount;
  }

  stop(): void {
    this.weeklyJob?.cancel();
  }
}

let scheduler: WeeklySummaryScheduler | null = null;

export const initializeWeeklySummaryScheduler = (): void => {
  if (!scheduler) {
    scheduler = new WeeklySummaryScheduler();
  }
};

export const stopWeeklySummaryScheduler = (): void => {
  if (scheduler) {
    scheduler.stop();
    scheduler = null;
    console.log('[WeeklySummary] Scheduler stopped');
  }
};
