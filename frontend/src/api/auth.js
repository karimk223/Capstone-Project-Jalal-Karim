/**
 * Auth API resource.
 * Wraps POST /auth/login and GET /auth/me per api-spec.md §1.
 *
 * Implements FR-1 (login) and FR-2 (JWT-based session) from the client side.
 * Addresses Gap 5 (real RBAC) by pulling role_name from the server response
 * rather than letting the client decide its own permissions.
 */

import apiClient from './client';

export async function login({ email, password }) {
  // Backend route: POST /api/v1/auth/login
  // Response: { token, staff: { staff_id, full_name, role_id, role_name } }
  const { data } = await apiClient.post('/api/v1/auth/login', { email, password });
  return data;
}

export async function getMe() {
  // Backend route: GET /api/v1/auth/me
  // Used on app boot to validate that a stored token is still good and to
  // recover the staff record without forcing a re-login.
  const { data } = await apiClient.get('/api/v1/auth/me');
  return data;
}

/**
 * POST /api/v1/auth/change-password
 * Allows the logged-in user to change their own password.
 * oldPassword is verified by the server against STAFF.password_hash (bcrypt).
 * newPassword is hashed by the server before storing — never stored plain.
 *
 * TODO(api-spec): Karim should add a formal definition for this route in
 * api-spec.md §1 with request body, response 200, and error codes:
 *   401 INVALID_CREDENTIALS — oldPassword wrong
 *   400 VALIDATION_FAILED   — newPassword fails Joi rules
 */
export async function changePassword({ oldPassword, newPassword }) {
  const { data } = await apiClient.post('/api/v1/auth/change-password', {
    oldPassword,
    newPassword,
  });
  return data;
}
