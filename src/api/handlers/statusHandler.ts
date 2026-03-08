import { Request, Response } from 'express';
import { healthCheckService } from '../../services/healthCheckService.js';
import { PaymentCanaryResultModel } from '../../models/paymentCanaryModel.js';
import handleRequest from '../../utils/requestHandler.js';

interface DailyAggregate {
  date: string;
  total: number;
  passed: number;
  failed: number;
  avgLatencyMs: number;
}

interface RecentCheck {
  timestamp: string;
  status: 'pass' | 'charge_failed';
  latencyMs: number;
}

export const getPublicStatus = handleRequest(async (_req: Request, _res: Response) => {
  const health = await healthCheckService.getHealth();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [dailyAgg, recentResults] = await Promise.all([
    PaymentCanaryResultModel.aggregate<{
      _id: string;
      total: number;
      passed: number;
      failed: number;
      avgLatencyMs: number;
    }>([
      { $match: { timestamp: { $gte: ninetyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Jerusalem' } },
          total: { $sum: 1 },
          passed: { $sum: { $cond: [{ $eq: ['$status', 'pass'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'charge_failed'] }, 1, 0] } },
          avgLatencyMs: { $avg: '$chargeLatencyMs' }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    PaymentCanaryResultModel.find()
      .sort({ timestamp: -1 })
      .limit(24)
      .select('timestamp status chargeLatencyMs')
      .lean()
  ]);

  const dailyHistory: DailyAggregate[] = dailyAgg.map((d) => ({
    date: d._id,
    total: d.total,
    passed: d.passed,
    failed: d.failed,
    avgLatencyMs: Math.round(d.avgLatencyMs)
  }));

  const recent: RecentCheck[] = recentResults.map((r) => ({
    timestamp: r.timestamp.toISOString(),
    status: r.status,
    latencyMs: r.chargeLatencyMs
  }));

  const totalChecks = dailyHistory.reduce((sum, d) => sum + d.total, 0);
  const totalPassed = dailyHistory.reduce((sum, d) => sum + d.passed, 0);
  const uptimePercent = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 10000) / 100 : null;

  const latestCheck = recent[0] ?? null;
  const paymentStatus = !latestCheck
    ? 'operational'
    : latestCheck.status === 'pass'
      ? 'operational'
      : 'degraded';

  const overallStatus =
    health.server.status === 'down' || health.database.status === 'down'
      ? 'major_outage'
      : health.server.status === 'degraded' || health.database.status === 'degraded' || paymentStatus === 'degraded'
        ? 'degraded'
        : 'operational';

  return {
    overall: overallStatus,
    services: {
      server: {
        status: health.server.status,
        uptimeSeconds: health.server.uptimeSeconds,
        memoryMb: health.server.memoryMb
      },
      database: {
        status: health.database.status,
        latencyMs: health.database.latencyMs ?? null
      },
      payments: {
        status: paymentStatus,
        uptimePercent,
        latestCheck: latestCheck
          ? { timestamp: latestCheck.timestamp, status: latestCheck.status, latencyMs: latestCheck.latencyMs }
          : null
      }
    },
    paymentHistory: {
      daily: dailyHistory,
      recent
    },
    timestamp: new Date().toISOString()
  };
});
