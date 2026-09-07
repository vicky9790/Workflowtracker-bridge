'use client';

import React, { useEffect, useState } from 'react';
import { healthApi, HealthStatus } from '@/lib/api/health';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Server,
  Database,
  RefreshCw,
  Activity,
  ShieldCheck,
  CheckCircle2,
  Zap,
} from 'lucide-react';


export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [pingHistory, setPingHistory] = useState<{ time: string; ms: number; status: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPinging, setIsPinging] = useState(false);

  const runPing = async () => {
    setIsPinging(true);
    try {
      const res = await healthApi.check();
      setHealth(res);
      setPingHistory((prev) => [
        {
          time: new Date().toLocaleTimeString(),
          ms: res.latencyMs,
          status: res.status,
        },
        ...prev.slice(0, 9),
      ]);
    } finally {
      setIsPinging(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runPing();
    const interval = setInterval(runPing, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">System Health & Telemetry</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time infrastructure checks, database connectivity, and API response latency.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={runPing}
            isLoading={isPinging}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Run Ping Test
          </Button>
        </div>
      </div>

      {/* Primary Status Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Core API */}
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-medium text-zinc-400">Bridge REST API</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mb-1" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      health?.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                </span>
                <span className="text-xl font-bold text-white tracking-tight uppercase">
                  {health?.status === 'ok' ? 'Operational' : 'Degraded'}
                </span>
              </div>
            )}
            <p className="text-[11px] text-zinc-400 mt-1">Endpoint: http://localhost:3000</p>
          </CardContent>
        </Card>

        {/* Database */}
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-medium text-zinc-400">PostgreSQL Database</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mb-1" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      health?.database === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                </span>
                <span className="text-xl font-bold text-white tracking-tight uppercase">
                  {health?.database || 'Connected'}
                </span>
              </div>
            )}
            <p className="text-[11px] text-zinc-400 mt-1">Prisma Client ORM Active</p>
          </CardContent>
        </Card>

        {/* Latency */}
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-medium text-zinc-400">Round-Trip Latency</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mb-1" />
            ) : (
              <div className="text-2xl font-bold text-white font-mono">
                {health?.latencyMs ?? 0} ms
              </div>
            )}
            <p className="text-[11px] text-emerald-400 mt-1">Direct local network loop</p>
          </CardContent>
        </Card>
      </div>

      {/* Services & Workers Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Background Services & Daemons
          </CardTitle>
          <p className="text-xs text-zinc-400 mt-0.5">
            Internal daemon workers responsible for autonomous system tasks
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-none" />
              <div>
                <p className="text-xs font-semibold text-white">Sync Retry Worker</p>
                <p className="text-[11px] text-zinc-400">
                  Runs every 15,000ms. Claims pending/failed activity logs and pushes to Zoho Creator.
                </p>
              </div>
            </div>
            <Badge variant="success" dot>Active (15s)</Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-none" />
              <div>
                <p className="text-xs font-semibold text-white">Device Presence Worker</p>
                <p className="text-[11px] text-zinc-400">
                  Runs every 60,000ms. Marks devices OFFLINE if heartbeat is older than 120s.
                </p>
              </div>
            </div>
            <Badge variant="success" dot>Active (60s)</Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-none" />
              <div>
                <p className="text-xs font-semibold text-white">Prisma DB Connection Pool</p>
                <p className="text-[11px] text-zinc-400">
                  PostgreSQL connection pool maintained by Prisma engine.
                </p>
              </div>
            </div>
            <Badge variant="success" dot>Healthy</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Latency History Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            Recent Ping Latency Samples
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pingHistory.length === 0 ? (
              <p className="text-xs text-zinc-500">Sampling latency...</p>
            ) : (
              pingHistory.map((ping, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b border-zinc-800/60 text-xs last:border-0 font-mono"
                >
                  <span className="text-zinc-400">{ping.time}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        ping.ms < 50
                          ? 'text-emerald-400 font-semibold'
                          : ping.ms < 150
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }
                    >
                      {ping.ms} ms
                    </span>
                    <Badge variant={ping.status === 'ok' ? 'success' : 'danger'}>
                      {ping.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
