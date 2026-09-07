import { apiRequest } from './client';
import { ZohoConnection } from '@/types';

export const zohoApi = {
  getStatus: async (): Promise<ZohoConnection & { connected: boolean }> => {
    return apiRequest<ZohoConnection & { connected: boolean }>('/api/zoho/status');
  },

  getConnectUrl: async (params: {
    account_owner_name: string;
    app_link_name: string;
    data_center?: string;
  }): Promise<{ authorization_url: string }> => {
    const query = new URLSearchParams({
      account_owner_name: params.account_owner_name,
      app_link_name: params.app_link_name,
    });
    if (params.data_center) query.set('data_center', params.data_center);
    return apiRequest<{ authorization_url: string }>(`/api/zoho/connect?${query.toString()}`);
  },

  disconnect: async (): Promise<{ connected: boolean }> => {
    return apiRequest<{ connected: boolean }>('/api/zoho/disconnect', {
      method: 'DELETE',
    });
  },
};
