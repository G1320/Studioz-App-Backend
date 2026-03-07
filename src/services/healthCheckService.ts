import mongoose from 'mongoose';

export type ServiceStatus = 'operational' | 'degraded' | 'down';

export interface ServiceHealth {
  status: ServiceStatus;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  server: ServiceHealth;
  database: ServiceHealth;
}

const DB_STATE_MAP: Record<number, ServiceStatus> = {
  0: 'down',        // disconnected
  1: 'operational',  // connected
  2: 'degraded',     // connecting
  3: 'down',         // disconnecting
};

export const healthCheckService = {
  checkServer(): ServiceHealth {
    const uptimeSeconds = process.uptime();
    const mem = process.memoryUsage();

    return {
      status: 'operational',
      details: {
        uptimeSeconds: Math.floor(uptimeSeconds),
        memoryUsage: {
          heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
          rssMB: Math.round(mem.rss / 1024 / 1024),
        },
      },
    };
  },

  checkDatabase(): ServiceHealth {
    const readyState = mongoose.connection.readyState;
    const status = DB_STATE_MAP[readyState] ?? 'down';

    return { status };
  },

  async checkAll(): Promise<HealthCheckResult> {
    const start = Date.now();
    const server = this.checkServer();
    const database = this.checkDatabase();
    const latencyMs = Date.now() - start;

    server.latencyMs = latencyMs;

    return { server, database };
  },
};
