'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { platformApi } from '@/lib/api/platform';
import { syncApi } from '@/lib/api/sync';
import { employeesApi } from '@/lib/api/employees';
import { Organization, Employee, Device, ActivationCodeResponse } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { CopyButton } from '@/components/shared/CopyButton';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Building2,
  ArrowLeft,
  Users,
  Monitor,
  Share2,
  Settings,
  RefreshCw,
  Key,
  Shield,
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '@/lib/utils';

export default function OrganizationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [syncCounts, setSyncCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Sync trigger state
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Activation modal state
  const [selectedEmployeeForActivation, setSelectedEmployeeForActivation] = useState<Employee | null>(null);
  const [activationResult, setActivationResult] = useState<ActivationCodeResponse | null>(null);
  const [isIssuingActivation, setIsIssuingActivation] = useState(false);

  const loadOrgDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [orgData, empData, devData, syncData] = await Promise.all([
        platformApi.getOrganizationById(id),
        platformApi.getEmployees({ organizationId: id, take: 50 }),
        platformApi.getDevices({ organizationId: id, take: 50 }),
        syncApi.getStatus(id),
      ]);
      setOrg(orgData);
      setEmployees(empData.items || []);
      setDevices(devData.items || []);
      setSyncCounts(syncData.counts || {});
    } catch (err: any) {
      setError(err?.message || 'Failed to load organization details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrgDetails();
  }, [loadOrgDetails]);

  const handleTriggerSync = async () => {
    if (!id) return;
    setIsTriggeringSync(true);
    setSyncResult(null);
    try {
      const res = await syncApi.triggerSync(id);
      setSyncResult(res);
      // Reload sync counts
      const updatedSync = await syncApi.getStatus(id);
      setSyncCounts(updatedSync.counts || {});
    } catch (err: any) {
      alert(err?.message || 'Failed to trigger synchronization.');
    } finally {
      setIsTriggeringSync(false);
    }
  };

  const handleIssueActivation = async (employee: Employee) => {
    setSelectedEmployeeForActivation(employee);
    setActivationResult(null);
    setIsIssuingActivation(true);
    try {
      const res = await employeesApi.issueActivationCode(employee.id);
      setActivationResult(res);
    } catch (err: any) {
      alert(err?.message || 'Failed to issue activation code.');
      setSelectedEmployeeForActivation(null);
    } finally {
      setIsIssuingActivation(false);
    }
  };

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'employees', label: 'Employees', icon: <Users className="w-3.5 h-3.5" />, count: employees.length },
    { id: 'devices', label: 'Devices', icon: <Monitor className="w-3.5 h-3.5" />, count: devices.length },
    { id: 'zoho', label: 'Zoho Creator', icon: <Share2 className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
    { id: 'sync', label: 'Sync Queue', icon: <RefreshCw className="w-3.5 h-3.5" /> },
  ];

  if (isLoading && !org) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-rose-400">Organization not found.</p>
        <Link href="/organizations" className="mt-4 inline-block">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Back to Organizations
          </Button>
        </Link>
      </div>
    );
  }

  const statusVariant =
    org.status === 'ACTIVE'
      ? 'success'
      : org.status === 'SUSPENDED'
      ? 'warning'
      : 'danger';

  return (
    <div className="space-y-6">
      {/* Back link & Org Header */}
      <div className="flex flex-col gap-3">
        <Link
          href="/organizations"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Organizations
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-white font-bold">
              {org.organizationName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {org.organizationName}
                </h2>
                <Badge variant={statusVariant} dot>
                  {org.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-zinc-400">
                  ID: {org.id}
                </span>
                <CopyButton text={org.id} />
                <span className="text-zinc-600">•</span>
                <span className="text-xs font-mono text-indigo-400">
                  Code: {org.organizationCode}
                </span>
                <CopyButton text={org.organizationCode} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadOrgDetails}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />


      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <span className="text-xs font-medium text-zinc-400">Registered Employees</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{org.stats?.employees ?? 0}</div>
                <p className="text-[11px] text-zinc-400 mt-1">Total provisioned users</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <span className="text-xs font-medium text-zinc-400">Total Devices</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{org.stats?.devices ?? 0}</div>
                <p className="text-[11px] text-emerald-400 mt-1">
                  {org.stats?.onlineDevices ?? 0} online now
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <span className="text-xs font-medium text-zinc-400">Zoho Creator Link</span>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-white">
                  {org.zohoConnection?.status || 'NOT_CONNECTED'}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  DC: {org.zohoConnection?.dataCenter || 'N/A'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Organization Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Organization Name</span>
                  <span className="font-semibold text-zinc-200">{org.organizationName}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Organization Code</span>
                  <span className="font-mono text-zinc-200">{org.organizationCode}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Created At</span>
                  <span className="text-zinc-200">{formatDate(org.createdAt)}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Last Updated</span>
                  <span className="text-zinc-200">{formatDate(org.updatedAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Org Admins */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                Organization Administrators
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {org.admins && org.admins.length > 0 ? (
                    org.admins.map((adm, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs text-white">{adm.email}</TableCell>
                        <TableCell>
                          <Badge variant="violet">{adm.role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-zinc-400">
                          {adm.createdAt ? formatDate(adm.createdAt) : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmpty colSpan={3} message="No administrators associated." />
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Employees */}
      {activeTab === 'employees' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm">Assigned Employees</CardTitle>
              <p className="text-xs text-zinc-400 mt-0.5">
                Staff provisioned in this tenant organization
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableEmpty colSpan={7} message="No employees found in this organization." />
                ) : (
                  employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium text-white">{emp.fullName}</TableCell>
                      <TableCell>
                        <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300">
                          {emp.employeeCode}
                        </code>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 font-mono">
                        {emp.email || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-300">{emp.department || '—'}</TableCell>
                      <TableCell className="text-xs text-zinc-300">{emp.designation || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={emp.status === 'ACTIVE' ? 'success' : 'neutral'}>
                          {emp.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleIssueActivation(emp)}
                          leftIcon={<Key className="w-3 h-3" />}
                        >
                          Issue Code
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tab: Devices */}
      {activeTab === 'devices' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Assigned Devices</CardTitle>
            <p className="text-xs text-zinc-400 mt-0.5">
              Desktop agent telemetry and status for this organization
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device Code</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>OS / Arch</TableHead>
                  <TableHead>Agent Version</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.length === 0 ? (
                  <TableEmpty colSpan={6} message="No devices registered for this organization." />
                ) : (
                  devices.map((dev) => (
                    <TableRow key={dev.id}>
                      <TableCell>
                        <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300">
                          {dev.deviceCode}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium text-white">{dev.hostname || '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={dev.status === 'ONLINE' ? 'success' : dev.status === 'OFFLINE' ? 'warning' : 'danger'}
                          dot
                        >
                          {dev.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-300">
                        {dev.os} {dev.arch ? `(${dev.arch})` : ''}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-zinc-400">
                        {dev.agentVersion || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400">
                        {formatRelativeTime(dev.lastSeen)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tab: Zoho */}
      {activeTab === 'zoho' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Share2 className="w-4 h-4 text-violet-400" />
              Zoho Creator Connection Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {org.zohoConnection ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Status</span>
                  <Badge variant={org.zohoConnection.status === 'CONNECTED' ? 'success' : 'danger'} dot>
                    {org.zohoConnection.status}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Data Center</span>
                  <span className="font-mono text-zinc-200">{org.zohoConnection.dataCenter || 'US'}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Account Owner</span>
                  <span className="text-zinc-200">{org.zohoConnection.accountOwnerName || '—'}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Application Link Name</span>
                  <span className="font-mono text-zinc-200">{org.zohoConnection.appLinkName || '—'}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Connected At</span>
                  <span className="text-zinc-200">{formatDate(org.zohoConnection.connectedAt)}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Last Error</span>
                  <span className="text-rose-400">{org.zohoConnection.lastError || 'None'}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                No Zoho Creator connection configured for this organization.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Organization Tracking Settings</CardTitle>
            <p className="text-xs text-zinc-400 mt-0.5">
              Configuration enforced on employee desktop agents
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {org.settings ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Time Zone</span>
                  <span className="font-medium text-zinc-200">{org.settings.timeZone}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Working Hours</span>
                  <span className="font-medium text-zinc-200">
                    {org.settings.workingHoursStart} — {org.settings.workingHoursEnd}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Admin Email</span>
                  <span className="font-mono text-zinc-200">{org.settings.administratorEmail}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Browser Tracking</span>
                  <Badge variant={org.settings.browserTracking ? 'success' : 'neutral'}>
                    {org.settings.browserTracking ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Application Tracking</span>
                  <Badge variant={org.settings.applicationTracking ? 'success' : 'neutral'}>
                    {org.settings.applicationTracking ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Screenshots</span>
                  <Badge variant={org.settings.screenshotsEnabled ? 'success' : 'neutral'}>
                    {org.settings.screenshotsEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Idle Detection</span>
                  <span className="text-zinc-200">
                    {org.settings.idleDetection ? `${org.settings.idleThresholdSeconds}s threshold` : 'Disabled'}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Screenshot Interval</span>
                  <span className="text-zinc-200">
                    {Math.round((org.settings.screenshotIntervalMs || 300000) / 1000)}s
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <span className="text-zinc-500 block mb-1">Onboarding Completed</span>
                  <Badge variant={org.settings.onboardingCompleted ? 'success' : 'warning'}>
                    {org.settings.onboardingCompleted ? 'Completed' : 'Pending'}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">No settings found for this organization.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Sync */}
      {activeTab === 'sync' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm">Synchronization Operations</CardTitle>
              <p className="text-xs text-zinc-400 mt-0.5">
                Trigger worker sync or inspect pending events for {org.organizationName}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerSync}
              isLoading={isTriggeringSync}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Trigger Sync Now
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  Failed
                </span>
                <span className="text-lg font-bold text-amber-400 font-mono">
                  {syncCounts['FAILED'] || 0}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                <span className="text-[11px] font-medium text-rose-400 uppercase tracking-wider block">
                  Dead
                </span>
                <span className="text-lg font-bold text-rose-400 font-mono">
                  {syncCounts['DEAD'] || 0}
                </span>
              </div>
            </div>

            {syncResult && (
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                Sync tick executed successfully. Results: {JSON.stringify(syncResult)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Activation Code Modal */}
      {selectedEmployeeForActivation && (
        <Modal
          isOpen={!!selectedEmployeeForActivation}
          onClose={() => setSelectedEmployeeForActivation(null)}
          title="Desktop Agent Activation Code"
          description={`Issue a one-time activation code for ${selectedEmployeeForActivation.fullName} (${selectedEmployeeForActivation.employeeCode}).`}
          footer={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEmployeeForActivation(null)}
            >
              Done
            </Button>
          }
        >
          <div className="space-y-4">
            {isIssuingActivation ? (
              <div className="p-6 text-center text-xs text-zinc-400">
                Generating secure activation token...
              </div>
            ) : activationResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center gap-2 text-center">
                  <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                    One-Time Activation Code
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-mono font-bold tracking-widest text-emerald-400 select-all">
                      {activationResult.activation_code}
                    </span>
                    <CopyButton text={activationResult.activation_code} size="md" />
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    Expires at: {formatDate(activationResult.expires_at)}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                  <p className="font-semibold mb-1">Security Notice</p>
                  <p>
                    This activation code will only be displayed ONCE. Provide it directly to the employee to enter into their TrackFlow Desktop Agent application.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-xs text-rose-400">
                Could not retrieve activation code.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
