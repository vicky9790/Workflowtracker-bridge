'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { platformApi } from '@/lib/api/platform';
import { employeesApi } from '@/lib/api/employees';
import { Employee, Organization, ActivationCodeResponse } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '@/components/ui/Table';
import { CopyButton } from '@/components/shared/CopyButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Search, Key, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';


import { formatDate } from '@/lib/utils';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Activation modal state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activationResult, setActivationResult] = useState<ActivationCodeResponse | null>(null);
  const [isIssuingActivation, setIsIssuingActivation] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await platformApi.getEmployees({
        skip: page * pageSize,
        take: pageSize,
        organizationId: selectedOrgId || undefined,
        search: search || undefined,
      });
      setEmployees(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load employees.');
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedOrgId, search]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    // Load organizations for filter
    platformApi.getOrganizations({ take: 100 }).then((res) => {
      setOrganizations(res.items || []);
    }).catch(() => {});
  }, []);

  const handleIssueActivation = async (emp: Employee) => {
    setSelectedEmployee(emp);
    setActivationResult(null);
    setIsIssuingActivation(true);
    try {
      const res = await employeesApi.issueActivationCode(emp.id);
      setActivationResult(res);
    } catch (err: any) {
      alert(err?.message || 'Failed to generate activation code.');
      setSelectedEmployee(null);
    } finally {
      setIsIssuingActivation(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Employees Directory</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monitor provisioned employees and issue desktop agent activation keys.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchEmployees}
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
                placeholder="Search by name, employee code, or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="w-full sm:w-64">
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
                    {org.organizationName} ({org.organizationCode})
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

      {/* Employees Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableEmpty colSpan={8} message="No employees found matching your criteria." />
              ) : (
                employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium text-white">
                      {emp.fullName}
                    </TableCell>
                    <TableCell>
                      <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300">
                        {emp.employeeCode}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs">
                      {emp.organization ? (
                        <Link
                          href={`/organizations/${emp.organization.id}`}
                          className="text-indigo-400 hover:underline"
                        >
                          {emp.organization.organizationName}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 font-mono">
                      {emp.email || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-300">
                      {emp.department || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-300">
                      {emp.designation || '—'}
                    </TableCell>
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
                        leftIcon={<Key className="w-3.5 h-3.5 text-indigo-400" />}
                      >
                        Issue Activation
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
                {Math.min((page + 1) * pageSize, total)} of {total} employees
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

      {/* Activation Code Modal */}
      {selectedEmployee && (
        <Modal
          isOpen={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          title="Desktop Agent Activation Code"
          description={`Issue a one-time activation code for ${selectedEmployee.fullName} (${selectedEmployee.employeeCode}).`}
          footer={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEmployee(null)}
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
                  <span className="text-[11px] text-zinc-500 font-mono">
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
