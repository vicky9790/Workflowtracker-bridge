import { API_BASE } from './client';

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'unreachable';
  database: string;
  time?: string;
  latencyMs: number;
}

export type HealthStatus = HealthCheckResult;


export const healthApi = {
  check: async (): Promise<HealthCheckResult> => {
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/health`, {
        cache: 'no-store',
      });
      const latencyMs = Date.now() - start;
      const data = await res.json();
      return {
        status: data.status || (res.ok ? 'ok' : 'degraded'),
        database: data.database || 'unknown',
        time: data.time,
        latencyMs,
      };
    } catch {
      return {
        status: 'unreachable',
        database: 'unreachable',
        latencyMs: Date.now() - start,
      };
    }
  },
};
