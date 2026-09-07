export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'DISABLED';
export type AdminRole = 'SUPER_ADMIN' | 'ORG_ADMIN';
export type SyncStatus = 'WAITING_CONNECTION' | 'PENDING' | 'IN_FLIGHT' | 'SUCCESS' | 'FAILED' | 'DEAD';
export type ZohoConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
export type ActivationStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any[];
  };
}

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  organizationId: string | null;
}

export interface OrganizationSettings {
  id: string;
  organizationId: string;
  administratorEmail: string;
  timeZone: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  browserTracking: boolean;
  applicationTracking: boolean;
  keyboardMetrics: boolean;
  mouseTracking: boolean;
  screenshotsEnabled: boolean;
  idleDetection: boolean;
  idleThresholdSeconds: number;
  screenshotIntervalMs: number;
  setupCompletedAt: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ZohoConnection {
  id?: string;
  organizationId?: string;
  accountOwnerName?: string;
  appLinkName?: string;
  dataCenter?: string;
  timeZone?: string;
  status: ZohoConnectionStatus;
  connectedAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Organization {
  id: string;
  organizationName: string;
  organizationCode: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
  admins?: { id?: string; email: string; role: AdminRole; createdAt?: string }[];
  zohoConnection?: ZohoConnection | null;
  settings?: OrganizationSettings | null;
  stats?: {
    employees: number;
    devices: number;
    onlineDevices: number;
  };
}

export interface Employee {
  id: string;
  organizationId: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  department: string | null;
  designation: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    organizationName: string;
    organizationCode: string;
  };
  devices?: {
    id: string;
    deviceCode: string;
    status: DeviceStatus;
    lastSeen: string | null;
  }[];
}

export interface Device {
  id: string;
  organizationId: string;
  employeeId: string;
  deviceCode: string;
  hostname: string | null;
  os: string | null;
  osVersion: string | null;
  arch: string | null;
  agentVersion: string | null;
  status: DeviceStatus;
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    organizationName: string;
    organizationCode: string;
  };
  employee?: {
    id: string;
    employeeCode: string;
    fullName: string;
  };
}

export interface SyncLog {
  id: string;
  organizationId: string;
  deviceId: string;
  eventType: string;
  eventId: string;
  zohoEndpoint: string;
  payload: any;
  status: SyncStatus;
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  zohoRecordId: string | null;
  createdAt: string;
  updatedAt: string;
  device?: {
    id: string;
    deviceCode: string;
    employee?: {
      employeeCode: string;
      fullName: string;
    };
  };
}

export interface AuditLog {
  id: string;
  organizationId: string | null;
  actorType: string;
  actorId: string | null;
  action: string;
  metadata: any;
  createdAt: string;
  organization?: {
    organizationName: string;
    organizationCode: string;
  } | null;
}

export interface PlatformOverview {
  organizations: { total: number; active: number };
  employees: { total: number; active: number };
  devices: { total: number; online: number };
  zohoConnections: { total: number; connected: number };
}

export interface ActivationCodeResponse {
  activation_code: string;
  activation_id: string;
  expires_at: string;
  employee_id: string;
}
