'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { message: string; code: string } | null;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('harbinger_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('harbinger_token');
          window.location.href = '/login';
        }
        return { success: false, data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } };
      }

      return {
        success: false,
        data: null,
        error: {
          message: data.message || `Request failed with status ${response.status}`,
          code: response.statusText || 'UNKNOWN',
        },
      };
    }

    return { success: true, data: data, error: null };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: { message: 'Failed to parse response', code: 'PARSE_ERROR' },
    };
  }
}

export const api = {
  get<T>(path: string): Promise<ApiResponse<T>> {
    return fetch(`${API_URL}${path}`, { method: 'GET', headers: getHeaders() }).then((r) => parseResponse<T>(r));
  },

  post<T, B = unknown>(path: string, body?: B): Promise<ApiResponse<T>> {
    return fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then((r) => parseResponse<T>(r));
  },

  delete<T>(path: string): Promise<ApiResponse<T>> {
    return fetch(`${API_URL}${path}`, { method: 'DELETE', headers: getHeaders() }).then((r) => parseResponse<T>(r));
  },
};
