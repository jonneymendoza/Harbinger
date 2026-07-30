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
  // Prefer the real session token. Preferring the guest token meant a user who
  // browsed as a guest before signing in kept sending GUEST credentials, so
  // every bookmark and admin call came back 403.
  const token = localStorage.getItem('harbinger_token') || localStorage.getItem('harbinger_guest_token');
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
    // The API already wraps every payload as { success, data, error }. Passing
    // that envelope straight through as `data` double-wrapped it, so callers had
    // to reach for `res.data.data` — and anything treating `res.data` as its
    // declared type (an array, say) crashed. Unwrap it here, once.
    const isEnvelope =
      data !== null && typeof data === 'object' && 'success' in data && 'data' in data;
    return { success: true, data: isEnvelope ? data.data : data, error: null };
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

  // Forbidden (403) — e.g. a guest attempting a write, or a non-admin hitting
  // an admin route. Surface the API's own error code so callers can branch on
  // GUEST_UPGRADE_REQUIRED; there is no hook to call from here.
  if (response.status === 403) {
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

    put<T, B = unknown>(path: string, body?: B): Promise<ApiResponse<T>> {
      const header = getAuthHeader();
      return fetch(`${API_URL}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: header || '' },
        body: JSON.stringify(body),
      }).then((r) => parseResponse<T>(r, false));
    },

    patch<T, B = unknown>(path: string, body?: B): Promise<ApiResponse<T>> {
      const header = getAuthHeader();
      return fetch(`${API_URL}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: header || '' },
        body: JSON.stringify(body ?? {}),
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
