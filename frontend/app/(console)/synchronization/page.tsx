'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { syncApi } from '@/lib/api/sync';
import { platformApi } from '@/lib/api/platform';
import { SyncLog, Organization, SyncStatus } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '@/components/ui/Table';
import { JsonViewer } from '@/components/shared/JsonViewer';
import { CopyButton } from '@/components/shared/CopyButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { RefreshCw, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';


export default function SynchronizationPage() {
  const [syncCounts, setSyncCounts] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync trigger state
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerFeedback, setTriggerFeedback] = useState<string | null>(null);

  // Payload modal state
  const [inspectLog, setInspectLog] = useState<SyncLog | null>(null);

  const loadSyncData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statusRes, logsRes] = await Promise.all([
        syncApi.getStatus(selectedOrgId || undefined),
        syncApi.getLogs({
          skip: page * pageSize,
          take: pageSize,
          status: statusFilter || undefined,
        }),
      ]);
      setSyncCounts(statusRes.counts || {});
      setLogs(logsRes.items || []);
      setTotal(logsRes.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch synchronization telemetry.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId, statusFilter, page]);

  useEffect(() => {
    loadSyncData();
  }, [loadSyncData]);

  useEffect(() => {
    platformApi.getOrganizations({ take: 100 }).then((res) => {
      setOrganizations(res.items || []);
    }).catch(() => {});
  }, []);

  const handleTriggerSync = async () => {
    setIsTriggering(true);
    setTriggerFeedback(null);
    try {
      const targetOrg = selectedOrgId || organizations[0]?.id;
      if (!targetOrg) {
        alert('Please select an organization to trigger sync.');
        return;
      }
      const res = await syncApi.triggerSync(targetOrg);
      setTriggerFeedback(
        `Sync worker tick dispatched. Processed: ${res.processed ?? 0}, Succeeded: ${res.success ?? 0}, Failed: ${res.failed ?? 0}`
      );
      await loadSyncData();
    } catch (err: any) {
      alert(err?.message || 'Failed to trigger sync worker.');
    } finally {
      setIsTriggering(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const getStatusBadge = (status: SyncStatus) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="success" dot>SUCCESS</Badge>;
      case 'IN_FLIGHT':
        return <Badge variant="blue" dot>IN_FLIGHT</Badge>;
      case 'PENDING':
        return <Badge variant="neutral" dot>PENDING</Badge>;
      case 'FAILED':
        return <Badge variant="warning">FAILED</Badge>;
      case 'DEAD':
        return <Badge variant="danger">DEAD</Badge>;
      case 'WAITING_CONNECTION':
        return <Badge variant="violet">WAITING</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Synchronization Engine</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monitor activity event queues, retry backoff worker ticks, and Zoho Creator payload sync.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadSyncData}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleTriggerSync}
            isLoading={isTriggering}
            leftIcon={<Play className="w-3.5 h-3.5" />}
          >
            Trigger Sync Now
          </Button>
        </div>
      </div>

      {triggerFeedback && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center justify-between animate-in fade-in">
          <span>{triggerFeedback}</span>
          <button
            onClick={() => setTriggerFeedback(null)}
            className="text-xs hover:underline text-emerald-300 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Queue Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-xs font-medium text-zinc-400 block mb-1">PENDING</span>
          <span className="text-2xl font-bold text-white font-mono">
            {syncCounts['PENDING'] || 0}
          </span>
          <p className="text-[10px] text-zinc-500 mt-1">Due for next worker tick</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-xs font-medium text-sky-400 block mb-1">IN_FLIGHT</span>
          <span className="text-2xl font-bold text-sky-400 font-mono">
            {syncCounts['IN_FLIGHT'] || 0}
          </span>
          <p className="text-[10px] text-zinc-500 mt-1">Dispatched to Creator API</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-xs font-medium text-emerald-400 block mb-1">SUCCESS</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono">
            {syncCounts['SUCCESS'] || 0}
          </span>
          <p className="text-[10px] text-zinc-500 mt-1">Confirmed in Zoho Creator</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-xs font-medium text-amber-400 block mb-1">FAILED</span>
          <span className="text-2xl font-bold text-amber-400 font-mono">
            {syncCounts['FAILED'] || 0}
          </span>
          <p className="text-[10px] text-zinc-500 mt-1">Exponential retry backoff</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-xs font-medium text-rose-400 block mb-1">DEAD</span>
          <span className="text-2xl font-bold text-rose-400 font-mono">
            {syncCounts['DEAD'] || 0}
          </span>
          <p className="text-[10px] text-zinc-500 mt-1">&ge; 5 failed attempts</p>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="w-full sm:flex-1">
              <Select
                value={selectedOrgId}
                onChange={(e) => {
                  setSelectedOrgId(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All Tenant Organizations</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.organizationName} ({org.organizationCode})
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-60">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="IN_FLIGHT">IN_FLIGHT</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
                <option value="DEAD">DEAD</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Activity Sync Logs & Event Stream</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event ID</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Last Error</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="text-right">Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableEmpty colSpan={9} message="No synchronization events found matching criteria." />
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300">
                          {log.eventId.substring(0, 12)}...
                        </code>
                        <CopyButton text={log.eventId} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono font-medium text-zinc-200">
                        {log.eventType}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-400">
                      {log.device?.deviceCode || log.deviceId.substring(0, 8)}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-300">
                      {log.device?.employee?.fullName || '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs font-mono text-zinc-300">
                      {log.attempts}
                    </TableCell>
                    <TableCell className="text-xs text-rose-400 max-w-xs truncate">
                      {log.lastError || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setInspectLog(log)}
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!isLoading && total > pageSize && (
            <div className="flex items-center justify-between p-4 border-t border-zinc-800">
              <span className="text-xs text-zinc-400">
                Showing {page * pageSize + 1} to{' '}
                {Math.min((page + 1) * pageSize, total)} of {total} sync events
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Previous
                </Button>
                <span className="text-xs font-mono text-zinc-400 px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inspect Payload Modal */}
      {inspectLog && (
        <Modal
          isOpen={!!inspectLog}
          onClose={() => setInspectLog(null)}
          title="Sync Event Payload"
          description={`Event: ${inspectLog.eventType} | Status: ${inspectLog.status} | Attempts: ${inspectLog.attempts}`}
          maxWidth="xl"
          footer={
            <Button variant="outline" size="sm" onClick={() => setInspectLog(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded bg-zinc-800/40 border border-zinc-800">
                <span className="text-zinc-500 block">Zoho Endpoint</span>
                <span className="font-mono text-zinc-200 break-all">{inspectLog.zohoEndpoint || '—'}</span>
              </div>
              <div className="p-2.5 rounded bg-zinc-800/40 border border-zinc-800">
                <span className="text-zinc-500 block">Zoho Record ID</span>
                <span className="font-mono text-emerald-400">{inspectLog.zohoRecordId || 'Not created yet'}</span>
              </div>
            </div>

            {inspectLog.lastError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                <p className="font-semibold mb-0.5">Last Error Message</p>
                <p className="font-mono text-[11px]">{inspectLog.lastError}</p>
              </div>
            )}

            <JsonViewer data={inspectLog.payload} title="Activity Payload Dispatched to Creator" />
          </div>
        </Modal>
      )}
    </div>
  );
}
