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

  // Last 24h canary results — only count tests that actually reached the
  // payment gateway (chargeLatencyMs > 0). Config-level failures (missing
  // card/credentials) have latency 0 and aren't real gateway issues.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const canaryResults = await PaymentCanaryResultModel.find({
    timestamp: { $gte: since },
    chargeLatencyMs: { $gt: 0 },
  })
    .sort({ timestamp: -1 })
    .select('status chargeLatencyMs timestamp')
    .lean();

  const totalTests = canaryResults.length;
  const passedTests = canaryResults.filter((r) => r.status === 'pass').length;
  const uptimePercent = totalTests > 0 ? Math.round((passedTests / totalTests) * 10000) / 100 : 100;
  const avgLatency =
    passedTests > 0
      ? Math.round(
          canaryResults
            .filter((r) => r.status === 'pass')
            .reduce((sum, r) => sum + r.chargeLatencyMs, 0) / passedTests
        )
      : 0;

  const lastCheck = canaryResults[0]?.timestamp || null;

  // Determine payment status from the most recent 3 gateway-reaching tests.
  // This avoids false alarms from intermittent canary failures (rate limits,
  // token quirks) while still catching real outages.
  const recent3 = canaryResults.slice(0, 3);
  const recentPasses = recent3.filter((r) => r.status === 'pass').length;

  let paymentStatus: ServiceStatus = 'operational';
  if (recent3.length > 0) {
    if (recentPasses === 0) paymentStatus = 'down';
    else if (recent3[0]?.status === 'charge_failed') paymentStatus = 'degraded';
  }

  const overall = resolveOverall(health.server.status, health.database.status, paymentStatus);

  return {
    overall,
    services: {
      server: {
        status: health.server.status,
        uptimeSeconds: health.server.details?.uptimeSeconds,
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
      },
    },
    timestamp: new Date().toISOString(),
  };
});
