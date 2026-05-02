import apiClient from './client';

export async function getStatuses() {
  const { data } = await apiClient.get('/api/v1/lookups/statuses');
  return data;
}

export async function getDepartments() {
  const { data } = await apiClient.get('/api/v1/lookups/departments');
  return data;
}

export async function getComplaintTypes() {
  const { data } = await apiClient.get('/api/v1/lookups/complaint-types');
  return data;
}

export async function getRoles() {
  const { data } = await apiClient.get('/api/v1/lookups/roles');
  return data;
}