// src/api/reports.js
// Thin axios wrapper for /reports/* endpoints.
// Matches the 4 routes in backend/src/routes/reports.js exactly.
// Implements FR-15 (dashboard analytics). Addresses Gap 6 (no reports in legacy).

import apiClient from './client';

/** GET /reports/counts-by-status → [{ status_name, count }] */
export async function getCountsByStatus() {
  const { data } = await apiClient.get('/api/v1/reports/counts-by-status');
  return data;
}

/** GET /reports/counts-by-category → [{ category, count }] */
export async function getCountsByCategory() {
  const { data } = await apiClient.get('/api/v1/reports/counts-by-category');
  return data;
}

/** GET /reports/average-resolution-time → { average_resolution_days } */
export async function getAverageResolutionTime() {
  const { data } = await apiClient.get('/api/v1/reports/average-resolution-time');
  return data;
}

/** GET /reports/complaints-per-staff → [{ full_name, role_name, complaint_count }] */
export async function getComplaintsPerStaff() {
  const { data } = await apiClient.get('/api/v1/reports/complaints-per-staff');
  return data;
}
