'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { platformApi } from '@/lib/api/platform';
import { syncApi } from '@/lib/api/sync';
import { PlatformOverview, Organization } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Building2,
  Users,
  Monitor,
  Share2,
  ArrowRight,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';


export default function DashboardPage() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [syncCounts, setSyncCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewData, orgsData, syncStatus] = await Promise.all([
        platformApi.getOverview(),
        platformApi.getOrganizations({ take: 5 }),
        syncApi.getStatus(),
      ]);
      setOverview(overviewData);
      setOrganizations(orgsData.items || []);
      setSyncCounts(syncStatus.counts || {});
    } catch (err: any) {
      setError(err?.message || 'Failed to load platform overview.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Platform Dashboard</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time aggregate telemetry across all organizations and background workers.
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
            Refresh Data
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Organizations */}
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-medium text-zinc-400">Total Organizations</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20 mb-1" />
            ) : (
              <div className="text-2xl font-bold text-white tracking-tight">
                {overview?.organizations.total ?? 0}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-400">
              <span className="text-emerald-400 font-medium">
                {overview?.organizations.active ?? 0} active
              </span>
              <span>across platform</span>
            </div>
          </CardContent>
        </Card>

        {/* Employees */}
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-medium text-zinc-400">Registered Employees</span>
            <Users className="w-4 h-4 text-sky-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20 mb-1" />
            ) : (
              <div className="text-2xl font-bold text-white tracking-tight">
                {overview?.employees.total ?? 0}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-400">
              <span className="text-sky-400 font-medium">
                {overview?.employees.active ?? 0} active
              </span>
              <span>tracked users</span>
            </div>
          </CardContent>
        </Card>

        {/* Devices */}
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-medium text-zinc-400">Tracked Devices</span>
            <Monitor className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20 mb-1" />
            ) : (
              <div className="text-2xl font-bold text-white tracking-tight">
                {overview?.devices.total ?? 0}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-400">
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                {overview?.devices.online ?? 0} online
              </span>
              <span>now</span>
            </div>
          </CardContent>
        </Card>

        {/* Zoho Connections */}
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-medium text-zinc-400">Zoho Creator Links</span>
            <Share2 className="w-4 h-4 text-violet-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20 mb-1" />
            ) : (
              <div className="text-2xl font-bold text-white tracking-tight">
                {overview?.zohoConnections.total ?? 0}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-400">
              <span className="text-violet-400 font-medium">
                {overview?.zohoConnections.connected ?? 0} linked
              </span>
              <span>accounts</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Queue Health Breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Synchronization Queue Status
            </CardTitle>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live batch queue status for Zoho Creator API ingestion
            </p>
          </div>
          <Link href="/synchronization">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Queue Details
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">
                Pending
              </span>
              <span className="text-lg font-bold text-zinc-100 font-mono">
                {syncCounts['PENDING'] || 0}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-[11px] font-medium text-sky-400 uppercase tracking-wider block">
                In-Flight
              </span>
              <span className="text-lg font-bold text-sky-400 font-mono">
                {syncCounts['IN_FLIGHT'] || 0}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">
                Success
              </span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {syncCounts['SUCCESS'] || 0}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">
                Failed (Retrying)
              </span>
              <span className="text-lg font-bold text-amber-400 font-mono">
                {syncCounts['FAILED'] || 0}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-[11px] font-medium text-rose-400 uppercase tracking-wider block">
                Dead (Max Retries)
              </span>
              <span className="text-lg font-bold text-rose-400 font-mono">
                {syncCounts['DEAD'] || 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Organizations Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Recent Organizations
            </CardTitle>
            <p className="text-xs text-zinc-400 mt-0.5">
              Newly registered or active tenant organizations
            </p>
          </div>
          <Link href="/organizations">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Zoho Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : organizations.length === 0 ? (
                <TableEmpty colSpan={8} message="No organizations found on platform." />
              ) : (
                organizations.map((org) => {
                  const statusVariant =
                    org.status === 'ACTIVE'
                      ? 'success'
                      : org.status === 'SUSPENDED'
                      ? 'warning'
                      : 'danger';

                  const zohoStatusVariant =
                    org.zohoConnection?.status === 'CONNECTED'
                      ? 'success'
                      : org.zohoConnection?.status === 'ERROR'
                      ? 'danger'
                      : 'neutral';

                  return (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium text-white">
                        {org.organizationName}
                      </TableCell>
                      <TableCell>
                        <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300">
                          {org.organizationCode}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant} dot>
                          {org.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{org.stats?.employees ?? 0}</TableCell>
                      <TableCell>
                        <span className="text-zinc-300">
                          {org.stats?.devices ?? 0}
                        </span>
                        {org.stats?.onlineDevices ? (
                          <span className="text-emerald-400 text-xs ml-1.5">
                            ({org.stats.onlineDevices} on)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={zohoStatusVariant}>
                          {org.zohoConnection?.status || 'NOT_CONNECTED'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400">
                        {formatDate(org.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/organizations/${org.id}`}>
                          <Button variant="secondary" size="sm">
                            Manage
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
