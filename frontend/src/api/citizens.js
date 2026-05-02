/**
 * src/api/citizens.js
 * Implements FR-9 (citizen lookup), FR-10 (duplicate national_id conflict).
 * Addresses Gap 10 (no de-duplicated applicant record in legacy system).
 */

import apiClient from './client';

/** Search citizens by name or national_id. Returns array. */
export async function searchCitizens(query) {
  const res = await apiClient.get(`/api/v1/citizens?q=${encodeURIComponent(query)}`);
  return res.data;
}

/** Create a new citizen record. Returns the created row. */
export async function createCitizen(data) {
  const res = await apiClient.post('/api/v1/citizens', data);
  return res.data;
}
