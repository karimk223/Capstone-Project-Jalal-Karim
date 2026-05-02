/**
 * src/api/dashboard.js
 * Dashboard API wrapper.
 */

import apiClient from './client';

export async function getDashboardSummary() {
  const { data } = await apiClient.get('/api/v1/dashboard/summary');
  return data;
}