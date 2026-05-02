/**
 * src/api/approvals.js
 * Wraps the approvals-related endpoints.
 * Pending approvals are complaints in "Pending Approval" status (status_id=3).
 * Approve/reject both go through POST /complaints/:id/transition per api-spec.md §2.
 * Implements FR-11, FR-13. Addresses Gap 6 (explicit approval workflow).
 */

import apiClient from './client';

/**
 * Fetch complaints currently pending approval.
 * Filters GET /complaints by status_id=3 (Pending Approval).
 * Directors see their department; Ministers/Admins see all.
 */
export async function getPendingApprovals() {
  const { data } = await apiClient.get('/api/v1/complaints', {
    params: { status_id: 3, limit: 50 },
  });
  return data;
}

/**
 * Approve a complaint — transitions to Approved (status_id=4).
 * Comment is optional for approvals (FR-13).
 */
export async function approveComplaint(complaintId, comment = '') {
  const { data } = await apiClient.post(
    `/api/v1/complaints/${complaintId}/transition`,
    { to_status_id: 4, comment }
  );
  return data;
}

/**
 * Reject a complaint — transitions to Rejected (status_id=5).
 * Comment is REQUIRED for rejections (FR-13).
 */
export async function rejectComplaint(complaintId, comment) {
  const { data } = await apiClient.post(
    `/api/v1/complaints/${complaintId}/transition`,
    { to_status_id: 5, comment }
  );
  return data;
}
