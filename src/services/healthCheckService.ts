import mongoose from 'mongoose';

export interface ServiceHealth {
  status: 'operational' | 'degraded' | 'down';
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  server: ServiceHealth & { uptimeSeconds: number; memoryMb: number };
  database: ServiceHealth;
}

export const healthCheckService = {
  async getHealth(): Promise<HealthReport> {
    const server = this.checkServer();
    const database = await this.checkDatabase();
    return { server, database };
  },

  checkServer(): HealthReport['server'] {
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
    const usageRatio = heapUsedMb / heapTotalMb;

    return {
      status: usageRatio > 0.95 ? 'degraded' : 'operational',
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: heapUsedMb,
      details: { heapTotalMb, rss: Math.round(mem.rss / 1024 / 1024) }
    };
  },

  async checkDatabase(): Promise<ServiceHealth> {
    const state = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (state !== 1) {
      return { status: 'down' };
    }

    const start = Date.now();
    try {
      await mongoose.connection.db!.admin().ping();
      const latencyMs = Date.now() - start;
      return {
        status: latencyMs > 2000 ? 'degraded' : 'operational',
        latencyMs
      };
    } catch {
      return { status: 'down' };
    }
  }
};
