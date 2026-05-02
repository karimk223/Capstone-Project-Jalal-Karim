/**
 * src/pages/ComplaintList.jsx
 * Implements FR-16 (structured filters), FR-17 (pagination + sort), FR-18
 * (plain-English empty state).
 *
 * Updated:
 * - Search by citizen national ID or file number
 * - Shows file number in the All Complaints table
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getComplaints } from '../api/complaints';
import { getStatuses } from '../api/lookups';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';

function formatDate(iso) {
  if (!iso) return '—';

  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function SortTh({ column, label, currentSort, currentDir, onSort }) {
  const isActive = currentSort === column;

  return (
    <th
      onClick={() => onSort(column)}
      className="cursor-pointer select-none px-4 py-3 text-left font-medium text-gray-600 transition-colors hover:bg-gray-100"
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (
          <span className="text-xs text-blue-500">
            {currentDir === 'asc' ? '▲' : '▼'}
          </span>
        ) : (
          <span className="text-xs text-gray-300">⇅</span>
        )}
      </span>
    </th>
  );
}

export default function ComplaintList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    search: '',
    status_id: '',
    priority: '',
    date_from: '',
    date_to: '',
  });

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('submitted_at');
  const [sortDir, setSortDir] = useState('desc');

  const LIMIT = 20;

  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStatuses().then(setStatuses).catch(() => {});
  }, []);

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getComplaints({
        ...filters,
        page,
        limit: LIMIT,
        sort_by: sortBy,
        sort_dir: sortDir,
      });

      setComplaints(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message || t('complaints.list.errorLoading'));
    } finally {
      setIsLoading(false);
    }
  }, [filters, page, sortBy, sortDir, t]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  function handleFilterChange(e) {
    const { name, value } = e.target;

    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({
      search: '',
      status_id: '',
      priority: '',
      date_from: '',
      date_to: '',
    });

    setPage(1);
  }

  function handleSort(column) {
    if (column === sortBy) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('desc');
    }

    setPage(1);
  }

  return (
    <div className="page-shell">
      <div className="page-header flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-ministry-700">
            Complaints Registry
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {t('complaints.list.title')}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => navigate('/complaints/new')}
          className="btn-primary"
        >
          {t('complaints.list.newButton')}
        </button>
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="flex min-w-[280px] flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">
            Search by Citizen ID or File Number
          </label>

          <input
            type="text"
            name="search"
            value={filters.search}
            onChange={handleFilterChange}
            placeholder="e.g. 123456789 or MIN-2026-0001"
            className="input-field py-1.5"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">
            {t('complaints.list.filterStatus')}
          </label>

          <select
            name="status_id"
            value={filters.status_id}
            onChange={handleFilterChange}
            className="input-field py-1.5"
          >
            <option value="">{t('complaints.list.allStatuses')}</option>
            {statuses.map((s) => (
              <option key={s.status_id} value={s.status_id}>
                {s.status_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">
            {t('complaints.list.filterPriority')}
          </label>

          <select
            name="priority"
            value={filters.priority}
            onChange={handleFilterChange}
            className="input-field py-1.5"
          >
            <option value="">{t('complaints.list.allPriorities')}</option>
            <option value="High">{t('complaints.priority.high')}</option>
            <option value="Medium">{t('complaints.priority.medium')}</option>
            <option value="Low">{t('complaints.priority.low')}</option>
            <option value="Urgent">{t('complaints.priority.urgent')}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">
            {t('complaints.list.filterFrom')}
          </label>

          <input
            type="date"
            name="date_from"
            value={filters.date_from}
            onChange={handleFilterChange}
            className="input-field py-1.5"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">
            {t('complaints.list.filterTo')}
          </label>

          <input
            type="date"
            name="date_to"
            value={filters.date_to}
            onChange={handleFilterChange}
            className="input-field py-1.5"
          />
        </div>

        {Object.values(filters).some(Boolean) && (
          <button
            type="button"
            onClick={clearFilters}
            className="btn-secondary self-end py-1.5"
          >
            {t('complaints.list.clearFilters')}
          </button>
        )}
      </div>

      {isLoading && (
        <div className="py-12 text-center text-sm text-gray-500">
          {t('app.loading')}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && complaints.length === 0 && (
        <div className="card border-dashed py-16 text-center">
          <p className="text-sm font-medium text-gray-900">
            {t('complaints.list.emptyTitle')}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {t('complaints.list.emptyHint')}
          </p>
        </div>
      )}

      {!isLoading && !error && complaints.length > 0 && (
        <>
          <div className="card overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t('complaints.list.colId')}
                  </th>

                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    File Number
                  </th>

                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t('complaints.list.colTitle')}
                  </th>

                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Citizen ID
                  </th>

                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t('complaints.list.colStatus')}
                  </th>

                  <SortTh
                    column="priority"
                    label={t('complaints.list.colPriority')}
                    currentSort={sortBy}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />

                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t('complaints.list.colDepartment')}
                  </th>

                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t('complaints.list.colSubmittedBy')}
                  </th>

                  <SortTh
                    column="submitted_at"
                    label={t('complaints.list.colDate')}
                    currentSort={sortBy}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />

                  <SortTh
                    column="completion_deadline"
                    label="Deadline"
                    currentSort={sortBy}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {complaints.map((c) => (
                  <tr
                    key={c.complaint_id}
                    onClick={() => navigate(`/complaints/${c.complaint_id}`)}
                    className="cursor-pointer transition-colors hover:bg-blue-50/70"
                  >
                    <td className="px-4 py-3 font-mono text-gray-500">
                      #{c.complaint_id}
                    </td>

                    <td className="px-4 py-3 font-mono text-gray-700">
                      {c.file_number || '—'}
                    </td>

                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.title}
                    </td>

                    <td className="px-4 py-3 font-mono text-gray-600">
                      {c.citizen_national_id || '—'}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge statusName={c.status_name} />
                    </td>

                    <td className="px-4 py-3">
                      <PriorityBadge priority={c.priority} />
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {c.department_name ?? '—'}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {c.submitted_by_name}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(c.submitted_at)}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(c.completion_deadline)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="card mt-4 flex items-center justify-between p-4 text-sm text-slate-600">
              <span>
                {t('complaints.list.pageInfo', {
                  page: pagination.page,
                  total: pagination.totalPages,
                  count: pagination.total,
                })}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                  className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('complaints.list.prev')}
                </button>

                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === pagination.totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('complaints.list.next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}