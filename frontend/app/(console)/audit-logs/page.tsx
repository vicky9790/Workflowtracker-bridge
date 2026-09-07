'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { platformApi } from '@/lib/api/platform';
import { AuditLog, Organization } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '@/components/ui/Table';
import { JsonViewer } from '@/components/shared/JsonViewer';
import { Skeleton } from '@/components/ui/Skeleton';
import { History, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

import { formatDate } from '@/lib/utils';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail inspection modal
  const [inspectLog, setInspectLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await platformApi.getAuditLogs({
        skip: page * pageSize,
        take: pageSize,
        organizationId: selectedOrgId || undefined,
        action: actionFilter || undefined,
      });
      setLogs(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load audit logs.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId, actionFilter, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    platformApi.getOrganizations({ take: 100 }).then((res) => {
      setOrganizations(res.items || []);
    }).catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  const getActionBadge = (action: string) => {
    if (action.includes('DISABLED') || action.includes('REVOKED') || action.includes('FAILED')) {
      return <Badge variant="danger">{action}</Badge>;
    }
    if (action.includes('ACTIVATION') || action.includes('ISSUED') || action.includes('CREATED')) {
      return <Badge variant="success">{action}</Badge>;
    }
    if (action.includes('STATUS')) {
      return <Badge variant="violet">{action}</Badge>;
    }
    return <Badge variant="neutral">{action}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Platform Audit Stream</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Immutable audit record of administrative actions, device lifecycle events, and token revocations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchLogs}
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

      {/* Filters */}
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
            <div className="w-full sm:w-64">
              <Select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All Actions</option>
                <option value="DEVICE_STATUS_CHANGED">DEVICE_STATUS_CHANGED</option>
                <option value="DEVICE_DISABLED">DEVICE_DISABLED</option>
                <option value="DEVICE_TOKEN_REVOKED">DEVICE_TOKEN_REVOKED</option>
                <option value="ORGANIZATION_STATUS_CHANGED">ORGANIZATION_STATUS_CHANGED</option>
                <option value="ORGANIZATION_SETTINGS_UPDATED">ORGANIZATION_SETTINGS_UPDATED</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            Event Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor Type</TableHead>
                <TableHead>Actor ID</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead className="text-right">Inspection</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableEmpty colSpan={6} message="No audit logs recorded matching criteria." />
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-zinc-400 font-mono">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-zinc-300">
                        {log.actorType}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-400">
                      {log.actorId ? `${log.actorId.substring(0, 10)}...` : 'System'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.organization ? (
                        <Link
                          href={`/organizations/${log.organizationId}`}
                          className="text-indigo-400 hover:underline"
                        >
                          {log.organization.organizationName}
                        </Link>
                      ) : (
                        'Platform'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setInspectLog(log)}
                      >
                        Details
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
                {Math.min((page + 1) * pageSize, total)} of {total} events
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

      {/* Inspect Modal */}
      {inspectLog && (
        <Modal
          isOpen={!!inspectLog}
          onClose={() => setInspectLog(null)}
          title="Audit Event Details"
          description={`Action: ${inspectLog.action} | Actor: ${inspectLog.actorType}`}
          maxWidth="lg"
          footer={
            <Button variant="outline" size="sm" onClick={() => setInspectLog(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded bg-zinc-800/40 border border-zinc-800">
                <span className="text-zinc-500 block">Logged At</span>
                <span className="font-mono text-zinc-200">{formatDate(inspectLog.createdAt)}</span>
              </div>
              <div className="p-2.5 rounded bg-zinc-800/40 border border-zinc-800">
                <span className="text-zinc-500 block">Actor ID</span>
                <span className="font-mono text-zinc-200">{inspectLog.actorId || 'Internal/System'}</span>
              </div>
            </div>

            <JsonViewer data={inspectLog.metadata} title="Event Metadata" />
          </div>
        </Modal>
      )}
    </div>
  );
}
