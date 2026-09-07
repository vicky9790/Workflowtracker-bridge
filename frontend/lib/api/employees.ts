import { apiRequest } from './client';
import { Employee, ActivationCodeResponse } from '@/types';

export const employeesApi = {
  list: async (params: { skip?: number; take?: number } = {}): Promise<{ items: Employee[]; total: number; skip: number; take: number }> => {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.set('skip', params.skip.toString());
    if (params.take !== undefined) query.set('take', params.take.toString());
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`/api/employees${qs}`);
  },

  getById: async (id: string): Promise<Employee> => {
    return apiRequest<Employee>(`/api/employees/${id}`);
  },

  create: async (data: {
    employeeCode: string;
    fullName: string;
    email?: string;
    department?: string;
    designation?: string;
  }): Promise<Employee> => {
    return apiRequest<Employee>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (
    id: string,
    data: {
      fullName?: string;
      email?: string;
      department?: string;
      designation?: string;
      status?: 'ACTIVE' | 'DISABLED';
    }
  ): Promise<Employee> => {
    return apiRequest<Employee>(`/api/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  issueActivation: async (id: string): Promise<ActivationCodeResponse> => {
    return apiRequest<ActivationCodeResponse>(`/api/employees/${id}/activation`, {
      method: 'POST',
    });
  },

  issueActivationCode: async (id: string): Promise<ActivationCodeResponse> => {
    return apiRequest<ActivationCodeResponse>(`/api/employees/${id}/activation`, {
      method: 'POST',
    });
  },
};

