'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { platformApi } from '@/lib/api/platform';
import { Organization, OrganizationStatus } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { Search, ChevronLeft, ChevronRight, RefreshCw, ShieldAlert } from 'lucide-react';

import { formatDate } from '@/lib/utils';

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status modal state
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [newStatus, setNewStatus] = useState<OrganizationStatus>('ACTIVE');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await platformApi.getOrganizations({
        skip: page * pageSize,
        take: pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setOrganizations(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load organizations.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleStatusUpdate = async () => {
    if (!selectedOrg) return;
    setIsUpdatingStatus(true);
    try {
      await platformApi.updateOrganizationStatus(selectedOrg.id, newStatus);
      setSelectedOrg(null);
      await fetchOrganizations();
    } catch (err: any) {
      alert(err?.message || 'Failed to update organization status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Organizations</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage tenant workspaces, credentials, and operational status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchOrganizations}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="w-full sm:flex-1">
              <Input
                placeholder="Search by organization name or code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DISABLED">DISABLED</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Organizations Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin Email</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Zoho Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : organizations.length === 0 ? (
                <TableEmpty colSpan={9} message="No organizations found matching the criteria." />
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

                  const adminEmail =
                    org.admins?.[0]?.email ||
                    org.settings?.administratorEmail ||
                    '—';

                  return (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium text-white">
                        <Link
                          href={`/organizations/${org.id}`}
                          className="hover:text-indigo-400 transition-colors"
                        >
                          {org.organizationName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300">
                          {org.organizationCode}
                        </code>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => {
                            setSelectedOrg(org);
                            setNewStatus(org.status);
                          }}
                          title="Click to change status"
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          <Badge variant={statusVariant} dot>
                            {org.status}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 font-mono">
                        {adminEmail}
                      </TableCell>
                      <TableCell>{org.stats?.employees ?? 0}</TableCell>
                      <TableCell>
                        <span className="text-zinc-300">
                          {org.stats?.devices ?? 0}
                        </span>
                        {org.stats?.onlineDevices ? (
                          <span className="text-emerald-400 text-xs ml-1 font-mono">
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

          {/* Pagination */}
          {!isLoading && total > pageSize && (
            <div className="flex items-center justify-between p-4 border-t border-zinc-800">
              <span className="text-xs text-zinc-400">
                Showing {page * pageSize + 1} to{' '}
                {Math.min((page + 1) * pageSize, total)} of {total} organizations
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

      {/* Change Status Modal */}
      {selectedOrg && (
        <Modal
          isOpen={!!selectedOrg}
          onClose={() => setSelectedOrg(null)}
          title="Update Organization Status"
          description={`Modify operational status for ${selectedOrg.organizationName} (${selectedOrg.organizationCode}).`}
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedOrg(null)}
                disabled={isUpdatingStatus}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStatusUpdate}
                isLoading={isUpdatingStatus}
              >
                Save Changes
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Select
              label="Operational Status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as OrganizationStatus)}
            >
              <option value="ACTIVE">ACTIVE - Full tracking and synchronization enabled</option>
              <option value="SUSPENDED">SUSPENDED - Temporarily paused</option>
              <option value="DISABLED">DISABLED - Agents blocked from checking in</option>
            </Select>

            <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-400 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-none mt-0.5" />
              <span>
                Setting status to DISABLED or SUSPENDED will immediately halt telemetry collection for all connected devices in this organization.
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
