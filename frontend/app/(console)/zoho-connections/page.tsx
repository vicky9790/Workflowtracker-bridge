'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { platformApi } from '@/lib/api/platform';
import { ZohoConnection } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { Share2, RefreshCw } from 'lucide-react';

import { formatDate } from '@/lib/utils';

export default function ZohoConnectionsPage() {
  const [connections, setConnections] = useState<(ZohoConnection & { organization?: any })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await platformApi.getZohoConnections();
      setConnections(res.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Zoho connections.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const total = connections.length;
  const connected = connections.filter((c) => c.status === 'CONNECTED').length;
  const errors = connections.filter((c) => c.status === 'ERROR').length;
  const disconnected = connections.filter((c) => c.status === 'DISCONNECTED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Zoho Creator Connections</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monitor OAuth tokens, data center endpoints, and live synchronization health with Zoho Creator.
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
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-zinc-400">Configured Connections</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{total}</div>
            <p className="text-[11px] text-zinc-400 mt-1">Tenant accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-zinc-400">Active & Connected</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{connected}</div>
            <p className="text-[11px] text-emerald-400/80 mt-1">Ready for event ingestion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-zinc-400">Sync Errors</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">{errors}</div>
            <p className="text-[11px] text-rose-400/80 mt-1">Token expired or invalid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-zinc-400">Disconnected</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-400">{disconnected}</div>
            <p className="text-[11px] text-zinc-500 mt-1">Awaiting re-authorization</p>
          </CardContent>
        </Card>
      </div>

      {/* Connections Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Share2 className="w-4 h-4 text-violet-400" />
            Connected Organizations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Account Owner</TableHead>
                <TableHead>App Link Name</TableHead>
                <TableHead>Data Center</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Connected At</TableHead>
                <TableHead>Last Error</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : connections.length === 0 ? (
                <TableEmpty colSpan={8} message="No Zoho Creator connections found across organizations." />
              ) : (
                connections.map((conn) => {
                  const statusVariant =
                    conn.status === 'CONNECTED'
                      ? 'success'
                      : conn.status === 'ERROR'
                      ? 'danger'
                      : 'neutral';

                  return (
                    <TableRow key={conn.id || conn.organizationId}>
                      <TableCell className="font-medium text-white">
                        {conn.organization ? (
                          <Link
                            href={`/organizations/${conn.organization.id}`}
                            className="text-indigo-400 hover:underline"
                          >
                            {conn.organization.organizationName}
                          </Link>
                        ) : (
                          'Unknown Org'
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-300">
                        {conn.accountOwnerName || '—'}
                      </TableCell>
                      <TableCell>
                        <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300">
                          {conn.appLinkName || '—'}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-zinc-300 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                          {conn.dataCenter || 'US'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant} dot>
                          {conn.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400">
                        {formatDate(conn.connectedAt)}
                      </TableCell>
                      <TableCell className="text-xs text-rose-400 max-w-xs truncate">
                        {conn.lastError || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {conn.organization?.id && (
                          <Link href={`/organizations/${conn.organization.id}`}>
                            <Button variant="secondary" size="sm">
                              Manage
                            </Button>
                          </Link>
                        )}
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
