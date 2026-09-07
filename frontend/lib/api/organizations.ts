import { apiRequest } from './client';
import { Organization, OrganizationSettings } from '@/types';

export const organizationsApi = {
  getMe: async (): Promise<Organization> => {
    return apiRequest<Organization>('/api/organizations/me');
  },

  updateMe: async (organizationName: string): Promise<Organization> => {
    return apiRequest<Organization>('/api/organizations/me', {
      method: 'PATCH',
      body: JSON.stringify({ organizationName }),
    });
  },

  getSettings: async (): Promise<OrganizationSettings> => {
    return apiRequest<OrganizationSettings>('/api/organizations/settings');
  },

  updateSettings: async (
    data: Partial<OrganizationSettings> & { organizationName?: string; setupCompleted?: boolean }
  ): Promise<OrganizationSettings & { organizationName?: string }> => {
    return apiRequest<OrganizationSettings & { organizationName?: string }>('/api/organizations/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
