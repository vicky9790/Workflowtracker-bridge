import { apiRequest } from './client';
import { AdminUser } from '@/types';

export interface LoginResponse {
  admin: AdminUser;
  token: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    return apiRequest<LoginResponse>('/api/organizations/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  getCurrentUser: (): AdminUser | null => {
    if (typeof window === 'undefined') return null;
    const str = localStorage.getItem('trackflow_admin_user');
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  },

  setCurrentUser: (user: AdminUser): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trackflow_admin_user', JSON.stringify(user));
    }
  },
};
