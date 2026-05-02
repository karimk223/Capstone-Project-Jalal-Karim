/**
 * Shared axios instance.
 *
 * Coding-conventions.md §5.2 requires server state to flow through a thin
 * axios wrapper in src/api/. This file is that wrapper. Every resource module
 * (auth.js, complaints.js, etc.) imports `apiClient` from here so we get:
 *
 *   1. ONE place to set the base URL (read from VITE_API_BASE_URL or '' so
 *      the Vite dev proxy can take over).
 *   2. ONE place to inject the JWT into the Authorization header (request
 *      interceptor below).
 *   3. ONE place to normalize backend errors into a consistent shape so
 *      components can rely on `err.code` and `err.message` without parsing
 *      axios's nested response object every time.
 *
 * Addresses Gap 7 (raw error codes leak to users) by guaranteeing every
 * caller receives a typed, human-readable error.
 */

import axios from 'axios';

// In dev, leave VITE_API_BASE_URL empty and let the Vite proxy forward /api
// to the backend. In production builds, set it to the absolute backend URL.
const baseURL = import.meta.env.VITE_API_BASE_URL || '';

// Storage key used by AuthContext. Defined here as well so the interceptor
// can read it without importing React (interceptors run outside the React tree).
export const TOKEN_STORAGE_KEY = 'mctcs_token';

const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  // 15s is generous for a localhost dev server; tighten later if needed.
  timeout: 15000,
});

// ── Request interceptor: attach the JWT if we have one ──────────────────────
apiClient.interceptors.request.use((config) => {
  // Read the token from localStorage on every request rather than caching it
  // in a closure — keeps logout/login transitions instant.
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: normalize errors ──────────────────────────────────
// The backend returns { error: { code, message } } per api-spec.md §9.
// We unwrap that and re-throw a plain Error with .code and .status so callers
// can do `catch (err) { if (err.code === 'INVALID_CREDENTIALS') ... }`.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // No response = network/CORS/timeout. The backend never saw the request.
    if (!error.response) {
      const networkErr = new Error('Network error');
      networkErr.code = 'NETWORK_ERROR';
      networkErr.status = 0;
      return Promise.reject(networkErr);
    }

    const { status, data } = error.response;
    const apiErr = new Error(data?.error?.message || 'Request failed');
    apiErr.code = data?.error?.code || 'UNKNOWN_ERROR';
    apiErr.status = status;

    // 401 with TOKEN_EXPIRED → clear the stale token so the next
    // ProtectedRoute check kicks the user back to /login.
    if (status === 401 && apiErr.code === 'TOKEN_EXPIRED') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    return Promise.reject(apiErr);
  }
);

export default apiClient;
