import { apiRequest } from './client';
import { Device, DeviceStatus } from '@/types';

export const devicesApi = {
  list: async (params: { skip?: number; take?: number } = {}): Promise<{ items: Device[]; total: number; skip: number; take: number }> => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.set('skip', params.skip.toString());
    if (params.take !== undefined) query.set('take', params.take.toString());
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`/api/devices${qs}`);
  },

  getById: async (id: string): Promise<Device> => {
    return apiRequest<Device>(`/api/devices/${id}`);
  },

  updateStatus: async (id: string, status: DeviceStatus): Promise<Device> => {
    try {
      return await apiRequest<Device>(`/api/platform/devices/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch {
      return apiRequest<Device>(`/api/devices/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    }
  },

  revokeToken: async (id: string): Promise<{ revoked: boolean }> => {
    try {
      return await apiRequest<{ revoked: boolean }>(`/api/platform/devices/${id}/revoke-token`, {
        method: 'POST',
      });
    } catch {
      return apiRequest<{ revoked: boolean }>(`/api/devices/${id}/revoke-token`, {
        method: 'POST',
      });
    }
  },
};

