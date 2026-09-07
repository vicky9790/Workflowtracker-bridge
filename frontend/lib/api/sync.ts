import { apiRequest } from './client';
import { SyncLog } from '@/types';

export const syncApi = {
  getStatus: async (organizationId?: string): Promise<{ organizationId: string | null; counts: Record<string, number> }> => {
    const query = organizationId ? `?organizationId=${organizationId}` : '';
    return apiRequest(`/api/sync/status${query}`);
  },

  getLogs: async (params: {
    skip?: number;
    take?: number;
    status?: string;
  } = {}): Promise<{ items: SyncLog[]; total: number; skip: number; take: number }> => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.set('skip', params.skip.toString());
    if (params.take !== undefined) query.set('take', params.take.toString());
    if (params.status) query.set('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`/api/sync/logs${qs}`);
  },

  triggerSync: async (organizationId: string): Promise<{ triggered: boolean; processed?: number; success?: number; failed?: number }> => {
    return apiRequest(`/api/sync/${organizationId}`, {
      method: 'POST',
    });
  },
};
