'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { platformApi } from '@/lib/api/platform';
import { devicesApi } from '@/lib/api/devices';
import { Device, Organization, DeviceStatus } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '@/components/ui/Table';
import { CopyButton } from '@/components/shared/CopyButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Search, RefreshCw, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';


export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [statusModalDevice, setStatusModalDevice] = useState<Device | null>(null);
  const [newStatus, setNewStatus] = useState<DeviceStatus>('ONLINE');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [revokeModalDevice, setRevokeModalDevice] = useState<Device | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await platformApi.getDevices({
        skip: page * pageSize,
        take: pageSize,
        organizationId: selectedOrgId || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setDevices(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load devices.');
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedOrgId, statusFilter, search]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    platformApi.getOrganizations({ take: 100 }).then((res) => {
      setOrganizations(res.items || []);
    }).catch(() => {});
  }, []);

  const handleStatusUpdate = async () => {
    if (!statusModalDevice) return;
    setIsUpdatingStatus(true);
    try {
      await devicesApi.updateStatus(statusModalDevice.id, newStatus);
      setStatusModalDevice(null);
      await fetchDevices();
    } catch (err: any) {
      alert(err?.message || 'Failed to update device status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRevokeToken = async () => {
    if (!revokeModalDevice) return;
    setIsRevoking(true);
    try {
      const res = await devicesApi.revokeToken(revokeModalDevice.id);
      alert(`Successfully revoked ${res.revoked} active device token(s). The device will need to re-enroll.`);
      setRevokeModalDevice(null);
      await fetchDevices();
    } catch (err: any) {
      alert(err?.message || 'Failed to revoke device token.');
    } finally {
      setIsRevoking(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Device Fleet</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monitor registered TrackFlow Desktop Agents, telemetry status, and security tokens.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDevices}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="w-full sm:flex-1">
              <Input
                placeholder="Search by device code or hostname..."
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
                <option value="ONLINE">ONLINE</option>
                <option value="OFFLINE">OFFLINE</option>
                <option value="DISABLED">DISABLED</option>
              </Select>
            </div>
            <div className="w-full sm:w-56">
              <Select
                value={selectedOrgId}
                onChange={(e) => {
                  setSelectedOrgId(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All Organizations</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.organizationName}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Devices Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device Code</TableHead>
                <TableHead>Hostname</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>OS / Arch</TableHead>
                <TableHead>Agent Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : devices.length === 0 ? (
                <TableEmpty colSpan={9} message="No devices found matching your criteria." />
              ) : (
                devices.map((dev) => {
                  const statusVariant =
                    dev.status === 'ONLINE'
                      ? 'success'
                      : dev.status === 'OFFLINE'
                      ? 'warning'
                      : 'danger';

                  return (
                    <TableRow key={dev.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300">
                            {dev.deviceCode}
                          </code>
                          <CopyButton text={dev.deviceCode} />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-white">
                        {dev.hostname || '—'}
                      </TableCell>
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
                      <TableCell className="text-xs text-zinc-300">
                        {dev.os || '—'} {dev.arch ? `(${dev.arch})` : ''}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-zinc-400">
                        {dev.agentVersion || '—'}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => {
                            setStatusModalDevice(dev);
                            setNewStatus(dev.status);
                          }}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          title="Click to toggle status"
                        >
                          <Badge variant={statusVariant} dot={dev.status === 'ONLINE'}>
                            {dev.status}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400">
                        {formatRelativeTime(dev.lastSeen)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setStatusModalDevice(dev);
                              setNewStatus(dev.status);
                            }}
                          >
                            Status
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRevokeModalDevice(dev)}
                            className="text-rose-400 hover:text-rose-300 border-rose-500/20"
                            title="Revoke active device session token"
                          >
                            Revoke
                          </Button>
                        </div>
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
                {Math.min((page + 1) * pageSize, total)} of {total} devices
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
      {statusModalDevice && (
        <Modal
          isOpen={!!statusModalDevice}
          onClose={() => setStatusModalDevice(null)}
          title="Update Device Status"
          description={`Set device status for ${statusModalDevice.deviceCode} (${statusModalDevice.hostname || 'Unknown Host'}).`}
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusModalDevice(null)}
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
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Select
              label="Device State"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as DeviceStatus)}
            >
              <option value="ONLINE">ONLINE - Device is reporting telemetry</option>
              <option value="OFFLINE">OFFLINE - Temporarily not communicating</option>
              <option value="DISABLED">DISABLED - Device rejected by Bridge</option>
            </Select>

            <p className="text-xs text-zinc-400">
              Note: Marking a device DISABLED prevents it from submitting activity batches until re-enabled.
            </p>
          </div>
        </Modal>
      )}

      {/* Revoke Token Modal */}
      {revokeModalDevice && (
        <Modal
          isOpen={!!revokeModalDevice}
          onClose={() => setRevokeModalDevice(null)}
          title="Revoke Device Token"
          description={`Revoke active authorization token for ${revokeModalDevice.deviceCode}?`}
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevokeModalDevice(null)}
                disabled={isRevoking}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRevokeToken}
                isLoading={isRevoking}
              >
                Confirm Revoke
              </Button>
            </>
          }
        >
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 flex-none mt-0.5" />
            <span>
              This will immediately invalidate the active JWT issued to this device. The desktop agent will stop transmitting activity events until it is re-enrolled using an activation code.
            </span>
          </div>
        </Modal>
      )}
    </div>
  );
}
