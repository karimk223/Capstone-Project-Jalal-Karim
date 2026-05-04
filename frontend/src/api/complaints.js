/**
 * src/api/complaints.js
 */

import apiClient from './client';

export async function getComplaints(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  );

  const { data } = await apiClient.get('/api/v1/complaints', { params: clean });
  return data;
}

export async function getComplaintById(id) {
  const { data } = await apiClient.get(`/api/v1/complaints/${id}`);
  return data;
}

export async function getComplaintTracking(id) {
  const { data } = await apiClient.get(`/api/v1/complaints/${id}/tracking`);
  return data;
}

export async function getComplaintAttachments(id) {
  const { data } = await apiClient.get(`/api/v1/complaints/${id}/attachments`);
  return data;
}

export function getAttachmentDownloadUrl(attachmentId) {
  return `/api/v1/attachments/${attachmentId}/download`;
}

export async function createComplaint(payload) {
  const { data } = await apiClient.post('/api/v1/complaints', payload);
  return data;
}

export async function updateComplaint(complaintId, payload) {
  const { data } = await apiClient.patch(`/api/v1/complaints/${complaintId}`, payload);
  return data;
}

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

export async function transitionComplaint(complaintId, toStatusId, comment = '') {
  const { data } = await apiClient.post(
    `/api/v1/complaints/${complaintId}/transition`,
    { to_status_id: toStatusId, comment }
  );

  return data;
}