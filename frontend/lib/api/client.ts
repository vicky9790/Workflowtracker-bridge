const API_BASE = process.env.NEXT_PUBLIC_BRIDGE_API_URL || 'http://localhost:3000';

class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: any[];

  constructor(message: string, code: string, statusCode: number, details?: any[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('trackflow_admin_token');
}

export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('trackflow_admin_token', token);
  }
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('trackflow_admin_token');
    localStorage.removeItem('trackflow_admin_user');
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      'Unable to connect to TrackFlow Bridge. Please ensure the backend server is running.',
      'NETWORK_ERROR',
      0
    );
  }

  // Handle 401 Unauthorized
  if (res.status === 401 && typeof window !== 'undefined') {
    if (!endpoint.includes('/login') && !endpoint.includes('/register')) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response
    if (!res.ok) {
      throw new ApiError(
        res.statusText || 'Server error',
        'SERVER_ERROR',
        res.status
      );
    }
    return {} as T;
  }

  if (!res.ok || json?.success === false) {
    const errorInfo = json?.error || {};
    throw new ApiError(
      errorInfo.message || `Request failed with status ${res.status}`,
      errorInfo.code || 'API_ERROR',
      res.status,
      errorInfo.details
    );
  }

  return json.data !== undefined ? json.data : json;
}

export { ApiError, API_BASE };
