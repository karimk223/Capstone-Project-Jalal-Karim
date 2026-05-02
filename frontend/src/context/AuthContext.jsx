/**
 * AuthContext.
 * Coding-conventions.md §5.2: "Auth state in AuthContext. Never read JWT
 * straight from localStorage inside components."
 *
 * Owns: the JWT (mirrored to localStorage so it survives reloads) and the
 * logged-in staff record { staff_id, full_name, role_id, role_name }.
 *
 * Exposes via context: { staff, isAuthenticated, isBooting, login, logout }.
 *
 * Implements FR-1, FR-2, FR-3 from the client side. Addresses Gap 5 by
 * making role_name the single source of truth for menu/route gating, fed
 * directly from the server's response rather than a client guess.
 */

import { createContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth';
import { TOKEN_STORAGE_KEY } from '../api/client';

// Exported so useAuth can subscribe; components should use the hook, not this
// context directly (cleaner stack traces and a single import path).
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [staff, setStaff] = useState(null);
  // isBooting = "we have a token, we're still verifying it with /auth/me".
  // Without this flag, ProtectedRoute would briefly redirect to /login on
  // every page reload before the verification request finishes.
  const [isBooting, setIsBooting] = useState(true);

  // ── Boot: if we have a token in storage, ask the backend who we are ───────
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setIsBooting(false);
      return;
    }

    let cancelled = false;
    authApi
      .getMe()
      .then((me) => {
        if (!cancelled) setStaff(me.staff);
      })
      .catch(() => {
        // Token is invalid or expired — clear it and treat as logged out.
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      })
      .finally(() => {
        if (!cancelled) setIsBooting(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── login(email, password): hits POST /auth/login, persists token+staff ──
  const login = useCallback(async ({ email, password }) => {
    const { token, staff: staffRecord } = await authApi.login({ email, password });
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setStaff(staffRecord);
    return staffRecord;
  }, []);

  // ── logout(): clear both client state and the stored token ──────────────
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setStaff(null);
  }, []);

  const value = {
    staff,
    isAuthenticated: !!staff,
    isBooting,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
