import { Request, Response } from 'express';
import { healthCheckService, type ServiceStatus } from '../../services/healthCheckService.js';
import { PaymentCanaryResultModel } from '../../models/paymentCanaryModel.js';
import handleRequest from '../../utils/requestHandler.js';

function resolveOverall(...statuses: ServiceStatus[]): 'operational' | 'degraded' | 'major_outage' {
  if (statuses.every((s) => s === 'operational')) return 'operational';
  if (statuses.some((s) => s === 'down')) return 'major_outage';
  return 'degraded';
}

/**
 * GET /api/status
 * Public, no auth — returns sanitized service health data.
 */
export const getStatus = handleRequest(async (_req: Request, _res: Response) => {
  const health = await healthCheckService.checkAll();

  // Last 24h canary results
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const canaryResults = await PaymentCanaryResultModel.find({ timestamp: { $gte: since } })
    .sort({ timestamp: -1 })
    .select('status chargeLatencyMs timestamp')
    .lean();

  const totalTests = canaryResults.length;
  const passedTests = canaryResults.filter((r) => r.status === 'pass').length;
  const uptimePercent = totalTests > 0 ? Math.round((passedTests / totalTests) * 10000) / 100 : 100;
  const avgLatency =
    totalTests > 0
      ? Math.round(canaryResults.reduce((sum, r) => sum + (r.chargeLatencyMs || 0), 0) / totalTests)
      : 0;

  const lastCheck = canaryResults[0]?.timestamp || null;
  const lastTestFailed = canaryResults[0]?.status === 'charge_failed';

  let paymentStatus: ServiceStatus = 'operational';
  if (totalTests === 0) paymentStatus = 'operational'; // no data yet, assume ok
  else if (uptimePercent < 50) paymentStatus = 'down';
  else if (uptimePercent < 90 || lastTestFailed) paymentStatus = 'degraded';

  const overall = resolveOverall(health.server.status, health.database.status, paymentStatus);

  return {
    overall,
    services: {
      server: {
        status: health.server.status,
        uptimeSeconds: health.server.details?.uptimeSeconds,
        memoryUsage: health.server.details?.memoryUsage,
        latencyMs: health.server.latencyMs,
      },
      database: {
        status: health.database.status,
      },
      payments: {
        status: paymentStatus,
        uptimePercent,
        avgLatencyMs: avgLatency,
        totalTests24h: totalTests,
        passedTests24h: passedTests,
        lastCheck,
        lastTestFailed,
      },
    },
    timestamp: new Date().toISOString(),
  };
});
