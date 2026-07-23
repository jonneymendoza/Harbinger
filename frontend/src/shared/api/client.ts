'use client';

import { useCallback } from 'react';
import { useAuth } from '@/features/auth/lib/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { message: string; code: string } | null;
}

/** Get auth headers from localStorage */
function getAuthHeader(): string | null {
  if (typeof window === 'undefined') return null;
  // Prefer guest token for public-allowed routes to maintain session continuity
  const token = localStorage.getItem('harbinger_guest_token') || localStorage.getItem('harbinger_token');
  return token ? `Bearer ${token}` : null;
}

/**
 * Centralized response parser.
 * @param publicEndpoint true for read-only endpoints that tolerate no token (401 → {data:null,success:true}); false for bookmark/admin routes that block without valid auth
 */
async function parseResponse<T>(response: Response, isPublic = false): Promise<ApiResponse<T>> {
  const getBodyPromise = () => {
    const ct = response.headers.get('content-type') || '';
    return ct.includes('json') ? response.json() : null;
  };

  let data: any;
  try {
    data = await getBodyPromise();
  } catch {
    // Non-JSON response body (e.g., text/html error page) — treat as fail
    if (!response.ok) {
      const err = `${response.status} ${response.statusText}`;
      return { success: false, data: null, error: { message: err, code: 'UNKNOWN' } };
    }
    // 204 No Content etc. — return success with null payload
    return { success: true, data: null as unknown as T, error: null };
  }

  if (response.ok) {
    return { success: true, data, error: null };
  }

  // -- Unauthorized handling by endpoint category --
  if (response.status === 401) {
    if (isPublic) {
      // Public/read-only endpoints accept no token; silently strip it and return empty
      localStorage.removeItem('harbinger_token');
      localStorage.removeItem('harbinger_user');
      localStorage.removeItem('harbinger_guest_token');
      return { success: true, data: null as unknown as T, error: null };
    }

    // Authenticated endpoint denied — clear stale tokens and redirect to login via context
    const authStatus = typeof window !== 'undefined' && localStorage.getItem('harbinger_guest_token');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('harbinger_token');
      localStorage.removeItem('harbinger_user');
      // Keep guest token so the user can still browse
      const guestToken = localStorage.getItem('harbinger_guest_token');
      if (!guestToken) {
        window.location.href = '/login';
      }
    }
    return { success: false, data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } };
  }

  // Forbidden (403) — guest trying to access a write endpoint
  if (response.status === 403) {
    if (typeof window !== 'undefined') {
      const auth = await import('@/features/auth/lib/AuthContext').then(m => m.useAuth?.());
      // We can't use hooks outside component; just return the error and let callers handle it
    }
    return { success: false, data: null, error: data?.error || { message: 'Forbidden', code: 'FORBIDDEN' } };
  }

  return { success: false, data: null, error: data?.error || { message: `Request failed with status ${response.status}`, code: response.statusText || 'UNKNOWN' } };
}

export const api = {
  // Public endpoints — no auth required; tolerate 401 gracefully
  public: {
    get<T>(path: string): Promise<ApiResponse<T>> {
      return fetch(`${API_URL}${path}`, { method: 'GET' }).then((r) => parseResponse<T>(r, true));
    },
    post<T, B = unknown>(path: string, body?: B): Promise<ApiResponse<T>> {
      return fetch(`${API_URL}${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }).then((r) => parseResponse<T>(r, true));
    },
  },

  // Authenticated endpoints — require valid JWT or redirect to login
  auth: {
    get<T>(path: string): Promise<ApiResponse<T>> {
      const header = getAuthHeader();
      return fetch(`${API_URL}${path}`, { method: 'GET', headers: { Authorization: header || '' } }).then((r) => parseResponse<T>(r, false));
    },

    post<T, B = unknown>(path: string, body?: B): Promise<ApiResponse<T>> {
      const header = getAuthHeader();
      return fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: header || '' },
        body: JSON.stringify(body),
      }).then((r) => parseResponse<T>(r, false));
    },

    delete<T>(path: string): Promise<ApiResponse<T>> {
      const header = getAuthHeader();
      return fetch(`${API_URL}${path}`, { method: 'DELETE', headers: { Authorization: header || '' } }).then((r) => parseResponse<T>(r, false));
    },
  },
};

/**
 * Convenience hook-based guest login trigger.
 * Call this from UI (e.g., "Continue as Guest" button).
 */
export function useGuestLogin() {
  const { setGuestToken } = useAuth();

  return useCallback(async (): Promise<boolean> => {
    try {
      const res = await api.public.post<{ token: string; expiresAt: string }>('/auth/guest');
      if (res.success && res.data?.token) {
        setGuestToken(res.data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [setGuestToken]);
}
