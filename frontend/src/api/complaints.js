/**
 * src/api/complaints.js
 * Implements FR-5 (create), FR-7 (attach file), FR-11 (transition).
 * Addresses Gap 4 (structured filters), Gap 3 (digital attachments).
 */

import apiClient from './client';

/** Fetch paginated filtered list — FR-16, FR-17 */
export async function getComplaints(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  );

  const { data } = await apiClient.get('/api/v1/complaints', { params: clean });
  return data;
}

/** Fetch single complaint with full detail — FR-20 */
export async function getComplaintById(id) {
  const { data } = await apiClient.get(`/api/v1/complaints/${id}`);
  return data;
}

/** Fetch tracking timeline — FR-19, FR-20 */
export async function getComplaintTracking(id) {
  const { data } = await apiClient.get(`/api/v1/complaints/${id}/tracking`);
  return data;
}

/** Fetch attachments list — FR-7 */
export async function getComplaintAttachments(id) {
  const { data } = await apiClient.get(`/api/v1/complaints/${id}/attachments`);
  return data;
}

/** Download URL — used as native <a href> */
export function getAttachmentDownloadUrl(attachmentId) {
  return `/api/v1/attachments/${attachmentId}/download`;
}

/**
 * Create a new complaint — FR-5, FR-6.
 */
export async function createComplaint(payload) {
  const { data } = await apiClient.post('/api/v1/complaints', payload);
  return data;
}

/**
 * Upload a file attachment — FR-7, FR-8.
 */
export async function uploadAttachment(complaintId, file) {
  const form = new FormData();
  form.append('file', file);

  const { data } = await apiClient.post(
    `/api/v1/complaints/${complaintId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );

  return data;
}

/**
 * Transition complaint status — FR-11, FR-12, FR-13.
 */
export async function transitionComplaint(complaintId, toStatusId, comment = '') {
  const { data } = await apiClient.post(
    `/api/v1/complaints/${complaintId}/transition`,
    { to_status_id: toStatusId, comment }
  );

  return data;
}