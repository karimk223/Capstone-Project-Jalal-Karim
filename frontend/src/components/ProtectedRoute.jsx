/**
 * ProtectedRoute.
 * Implements FR-3 (every protected route checks auth + role) on the client.
 * Note: the server is still the source of truth (Gap 5) — this component
 * exists for UX, hiding pages the user can't use rather than relying on a
 * 403 response after a wasted round-trip.
 *
 * Usage:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *   </Route>
 *
 *   // Restrict to specific roles:
 *   <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
 *     <Route path="/users" element={<UserManagement />} />
 *   </Route>
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, isBooting, staff } = useAuth();
  const location = useLocation();

  // While we're verifying a stored token, render nothing rather than flashing
  // a redirect to /login that we'd immediately undo.
  if (isBooting) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve the originally requested path so we can bounce back after login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(staff.role_name)) {
    // Authenticated but wrong role — send them to the dashboard rather than
    // a dead end. Server still enforces real RBAC on the API call.
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
