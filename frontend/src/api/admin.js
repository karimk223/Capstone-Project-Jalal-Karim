/**
 * src/api/admin.js
 * Wraps Admin-only staff management endpoints per api-spec.md §6.
 * Implements FR-1 (account creation), FR-4 (disable without deletion).
 * Addresses Gap 5 (real server-side RBAC — Admin role enforced on backend).
 */

import apiClient from './client';

/** List all staff members */
export async function getStaff() {
  const { data } = await apiClient.get('/api/v1/admin/staff');
  return data.data;
}

/**
 * Create a new staff account.
 * @param {{ full_name, email, password, role_id }} payload
 */
export async function createStaff(payload) {
  const { data } = await apiClient.post('/api/v1/admin/staff', payload);
  return data;
}

/**
 * Update a staff member — name, email, role, or is_active.
 * @param {number} staffId
 * @param {{ full_name?, email?, role_id?, is_active? }} payload
 */
export async function updateStaff(staffId, payload) {
  const { data } = await apiClient.patch(`/api/v1/admin/staff/${staffId}`, payload);
  return data;
}

/**
 * Admin reset password for a staff member.
 * @param {number} staffId
 * @param {string} password
 */
export async function resetStaffPassword(staffId, password) {
  const { data } = await apiClient.patch(`/api/v1/admin/staff/${staffId}/password`, {
    password,
  });

  return data;
}