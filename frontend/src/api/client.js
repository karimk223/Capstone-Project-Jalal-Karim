/**
 * Shared axios instance.
 *
 * Coding-conventions.md §5.2 requires server state to flow through a thin
 * axios wrapper in src/api/. This file is that wrapper. Every resource module
 * (auth.js, complaints.js, etc.) imports `apiClient` from here so we get:
 *
 *   1. ONE place to set the base URL (read from VITE_API_BASE_URL or '' so
 *      the Vite dev proxy can take over).
 *   2. ONE place to inject the JWT into the Authorization header.
 *   3. ONE place to normalize backend errors into a consistent shape.
 *
 * Updated:
 * - Supports both backend error formats:
 *   { error: { code, message } }
 *   { code, message }
 * - This fixes invalid workflow messages showing as "Request failed".
 */

import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '';

export const TOKEN_STORAGE_KEY = 'mctcs_token';

const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function extractApiError(data) {
  const message =
    data?.error?.message ||
    data?.message ||
    data?.errors?.[0]?.message ||
    'Request failed';

  const code =
    data?.error?.code ||
    data?.code ||
    data?.errors?.[0]?.code ||
    'UNKNOWN_ERROR';

  return { message, code };
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      const networkErr = new Error('Network error');
      networkErr.code = 'NETWORK_ERROR';
      networkErr.status = 0;
      return Promise.reject(networkErr);
    }

    const { status, data } = error.response;
    const { message, code } = extractApiError(data);

    const apiErr = new Error(message);
    apiErr.code = code;
    apiErr.status = status;
    apiErr.data = data;

    if (status === 401 && apiErr.code === 'TOKEN_EXPIRED') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    return Promise.reject(apiErr);
  }
);

export default apiClient;