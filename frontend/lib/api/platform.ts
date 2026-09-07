import { apiRequest } from './client';
import {
  PlatformOverview,
  Organization,
  Employee,
  Device,
  ZohoConnection,
  AuditLog,
  OrganizationStatus,
} from '@/types';

export const platformApi = {
  getOverview: async (): Promise<PlatformOverview> => {
    return apiRequest<PlatformOverview>('/api/platform/overview');
  },

  getOrganizations: async (params: {
    skip?: number;
    take?: number;
    search?: string;
    status?: string;
  } = {}): Promise<{ items: Organization[]; total: number; skip: number; take: number }> => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.set('skip', params.skip.toString());
    if (params.take !== undefined) query.set('take', params.take.toString());
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`/api/platform/organizations${qs}`);
  },

  getOrganizationById: async (id: string): Promise<Organization> => {
    return apiRequest<Organization>(`/api/platform/organizations/${id}`);
  },

  updateOrganizationStatus: async (
    id: string,
    status: OrganizationStatus
  ): Promise<Organization> => {
    return apiRequest<Organization>(`/api/platform/organizations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getEmployees: async (params: {
    skip?: number;
    take?: number;
    organizationId?: string;
    search?: string;
    status?: string;
  } = {}): Promise<{ items: Employee[]; total: number; skip: number; take: number }> => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.set('skip', params.skip.toString());
    if (params.take !== undefined) query.set('take', params.take.toString());
    if (params.organizationId) query.set('organizationId', params.organizationId);
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`/api/platform/employees${qs}`);
  },

  getDevices: async (params: {
    skip?: number;
    take?: number;
    organizationId?: string;
    search?: string;
    status?: string;
  } = {}): Promise<{ items: Device[]; total: number; skip: number; take: number }> => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.set('skip', params.skip.toString());
    if (params.take !== undefined) query.set('take', params.take.toString());
    if (params.organizationId) query.set('organizationId', params.organizationId);
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`/api/platform/devices${qs}`);
  },

  getZohoConnections: async (): Promise<{ items: (ZohoConnection & { organization?: any })[]; total: number }> => {
    return apiRequest('/api/platform/zoho-connections');
  },

  getAuditLogs: async (params: {
    skip?: number;
    take?: number;
    organizationId?: string;
    action?: string;
  } = {}): Promise<{ items: AuditLog[]; total: number; skip: number; take: number }> => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.set('skip', params.skip.toString());
    if (params.take !== undefined) query.set('take', params.take.toString());
    if (params.organizationId) query.set('organizationId', params.organizationId);
    if (params.action) query.set('action', params.action);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`/api/platform/audit-logs${qs}`);
  },
};
