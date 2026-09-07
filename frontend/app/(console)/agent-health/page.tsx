'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { platformApi } from '@/lib/api/platform';
import { Device } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { Monitor, AlertTriangle, RefreshCw, Cpu } from 'lucide-react';

import { formatRelativeTime } from '@/lib/utils';


export default function AgentHealthPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await platformApi.getDevices({ take: 100 });
      setDevices(res.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch agent health telemetry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.status === 'ONLINE').length;
  const offlineDevices = devices.filter((d) => d.status === 'OFFLINE').length;
  const disabledDevices = devices.filter((d) => d.status === 'DISABLED').length;

  // Group by Agent Version
  const versionDistribution = devices.reduce((acc, dev) => {
    const v = dev.agentVersion || 'Unknown';
    acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Group by OS
  const osDistribution = devices.reduce((acc, dev) => {
    const os = dev.os || 'Unknown';
    acc[os] = (acc[os] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Inactive / Stale devices
  const inactiveDevices = devices.filter((d) => d.status === 'OFFLINE' || d.status === 'DISABLED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Agent Fleet Health</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Presence monitoring, heartbeat timing, and software version distribution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-zinc-400">Total Enrolled</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalDevices}</div>
            <p className="text-[11px] text-zinc-400 mt-1">Across all organizations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-zinc-400">Online & Active</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{onlineDevices}</div>
            <p className="text-[11px] text-emerald-400/80 mt-1">Transmitting heartbeats</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-zinc-400">Offline</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{offlineDevices}</div>
            <p className="text-[11px] text-amber-400/80 mt-1">&gt; 120s since last seen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-zinc-400">Disabled</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">{disabledDevices}</div>
            <p className="text-[11px] text-rose-400/80 mt-1">Blocked by administrator</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Agent Version Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Agent Versions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(versionDistribution).length === 0 ? (
              <p className="text-xs text-zinc-500">No agent versions recorded yet.</p>
            ) : (
              Object.entries(versionDistribution).map(([version, count]) => {
                const percent = totalDevices ? Math.round((count / totalDevices) * 100) : 0;
                return (
                  <div key={version} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-zinc-300">v{version}</span>
                      <span className="text-zinc-400 font-mono">
                        {count} ({percent}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Operating Systems */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Monitor className="w-4 h-4 text-sky-400" />
              Operating System Fleet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(osDistribution).length === 0 ? (
              <p className="text-xs text-zinc-500">No OS data reported yet.</p>
            ) : (
              Object.entries(osDistribution).map(([os, count]) => {
                const percent = totalDevices ? Math.round((count / totalDevices) * 100) : 0;
                return (
                  <div key={os} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 capitalize">{os}</span>
                      <span className="text-zinc-400 font-mono">
                        {count} ({percent}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Offline / Inactive Devices Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Devices Requiring Attention (Offline or Disabled)
          </CardTitle>
          <p className="text-xs text-zinc-400 mt-0.5">
            Agents that have not communicated within the expected 120-second heartbeat window
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device Code</TableHead>
                <TableHead>Hostname</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Assigned Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : inactiveDevices.length === 0 ? (
                <TableEmpty colSpan={7} message="All registered devices are online and active!" />
              ) : (
                inactiveDevices.map((dev) => (
                  <TableRow key={dev.id}>
                    <TableCell>
                      <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300">
                        {dev.deviceCode}
                      </code>
                    </TableCell>
                    <TableCell className="font-medium text-white">{dev.hostname || '—'}</TableCell>
                    <TableCell className="text-xs">
                      {dev.organization ? (
                        <Link
                          href={`/organizations/${dev.organization.id}`}
                          className="text-indigo-400 hover:underline"
                        >
                          {dev.organization.organizationName}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-300">
                      {dev.employee?.fullName || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dev.status === 'OFFLINE' ? 'warning' : 'danger'}>
                        {dev.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400">
                      {formatRelativeTime(dev.lastSeen)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href="/devices">
                        <Button variant="secondary" size="sm">
                          Inspect
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
