/**
 * src/pages/ComplaintList.jsx
 * Updated:
 * - Colored status overview cards
 * - Added Overdue overview card that behaves like the other cards
 * - Dashboard /complaints?overdue=1 opens with overdue filter applied
 * - Status cards remain visible even when Overdue filter is active
 * - Pending Approval card opens Approvals page
 * - Fixed long status labels overflowing card borders
 * - Overdue is shown as an extra red badge beside the real status
 * - Shows latest dynamic approval/rejection decision and actor
 * - Table is horizontally scrollable so all columns remain visible
 * - Decision column is cleaner and compact
 * - Added filter for complaints submitted by the logged-in user
 * - From and To date filters are stacked vertically
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

function formatDecision(item) {
  if (!item?.decision_action || !item?.decision_by_name) return '—';

  const action =
    String(item.decision_action).toLowerCase() === 'approved'
      ? 'Approved'
      : 'Rejected';

  const role = item.decision_by_role || 'Staff';

  return `${action} by ${role} ${item.decision_by_name}`;
}

function isOverdueComplaint(item) {
  if (!item?.completion_deadline) return false;

  const status = String(item.status_name || '').toLowerCase();
  const terminalStatuses = ['resolved', 'closed', 'rejected'];

  if (terminalStatuses.includes(status)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(item.completion_deadline);
  deadline.setHours(0, 0, 0, 0);

  return deadline < today;
}

function SortTh({ column, label, currentSort, currentDir, onSort }) {
  const isActive = currentSort === column;

  return (
    <th
      onClick={() => onSort(column)}
      className="cursor-pointer select-none px-4 py-3 text-left font-medium text-gray-600 transition-colors hover:bg-gray-100"
    >
      <span className="flex items-center gap-1 whitespace-nowrap">
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

function getStatusCardClasses(label, active) {
  const key = String(label).toLowerCase();

  const tones = {
    all: active
      ? 'border-slate-400 bg-slate-100 ring-2 ring-slate-200'
      : 'border-slate-200 bg-slate-50 hover:bg-slate-100',

    submitted: active
      ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
      : 'border-blue-200 bg-blue-50 hover:bg-blue-100',

    'under review': active
      ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
      : 'border-amber-200 bg-amber-50 hover:bg-amber-100',

    'pending approval': active
      ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
      : 'border-violet-200 bg-violet-50 hover:bg-violet-100',

    approved: active
      ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
      : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',

    rejected: active
      ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-200'
      : 'border-rose-200 bg-rose-50 hover:bg-rose-100',

    resolved: active
      ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-200'
      : 'border-teal-200 bg-teal-50 hover:bg-teal-100',

    closed: active
      ? 'border-gray-400 bg-gray-100 ring-2 ring-gray-200'
      : 'border-gray-200 bg-gray-50 hover:bg-gray-100',

    overdue: active
      ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
      : 'border-red-200 bg-red-50 hover:bg-red-100',
  };

  return tones[key] || tones.all;
}

function StatusSummaryCard({ label, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[112px] rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${getStatusCardClasses(
        label,
        active
      )}`}
    >
      <p className="max-w-full break-words text-[10px] font-bold uppercase leading-4 tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-slate-950">{value ?? 0}</p>
    </button>
  );
}

export default function ComplaintList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status_id: searchParams.get('status_id') || '',
    priority: searchParams.get('priority') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    open: searchParams.get('open') || '',
    overdue: searchParams.get('overdue') || '',
    resolved_this_month: searchParams.get('resolved_this_month') || '',
    my_submitted: searchParams.get('my_submitted') || '',
  });

  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [sortBy, setSortBy] = useState('submitted_at');
  const [sortDir, setSortDir] = useState('desc');

  const LIMIT = 20;

  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [statusCounts, setStatusCounts] = useState([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStatuses().then(setStatuses).catch(() => {});
  }, []);

  useEffect(() => {
    const params = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value != null) {
        params[key] = value;
      }
    });

    if (page > 1) params.page = String(page);

    setSearchParams(params, { replace: true });
  }, [filters, page, setSearchParams]);

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const displayResultPromise = getComplaints({
        ...filters,
        page,
        limit: LIMIT,
        sort_by: sortBy,
        sort_dir: sortDir,
      });

      const overviewResultPromise = getComplaints({
        search: filters.search,
        priority: filters.priority,
        date_from: filters.date_from,
        date_to: filters.date_to,
        my_submitted: filters.my_submitted,
        page: 1,
        limit: 1,
        sort_by: sortBy,
        sort_dir: sortDir,
      });

      const overdueResultPromise = getComplaints({
        search: filters.search,
        priority: filters.priority,
        date_from: filters.date_from,
        date_to: filters.date_to,
        my_submitted: filters.my_submitted,
        overdue: '1',
        page: 1,
        limit: 1,
        sort_by: sortBy,
        sort_dir: sortDir,
      });

      const [displayResult, overviewResult, overdueResult] = await Promise.all([
        displayResultPromise,
        overviewResultPromise,
        overdueResultPromise,
      ]);

      setComplaints(displayResult.data);
      setPagination(displayResult.pagination);

      setStatusCounts(overviewResult.status_counts || []);
      setOverdueCount(overdueResult.pagination?.total || 0);
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

    setFilters((prev) => ({
      ...prev,
      [name]: value,
      open: '',
      overdue: '',
      resolved_this_month: '',
    }));

    setPage(1);
  }

  function clearFilters() {
    setFilters({
      search: '',
      status_id: '',
      priority: '',
      date_from: '',
      date_to: '',
      open: '',
      overdue: '',
      resolved_this_month: '',
      my_submitted: '',
    });

    setPage(1);
  }

  function filterByStatus(status) {
    const statusName = String(status.status_name || '').toLowerCase();

    if (statusName === 'pending approval') {
      navigate('/approvals');
      return;
    }

    setFilters((prev) => ({
      ...prev,
      status_id: String(status.status_id),
      open: '',
      overdue: '',
      resolved_this_month: '',
    }));

    setPage(1);
  }

  function filterByOverdue() {
    setFilters((prev) => ({
      ...prev,
      status_id: '',
      open: '',
      overdue: '1',
      resolved_this_month: '',
    }));

    setPage(1);
  }

  function showAllStatuses() {
    setFilters((prev) => ({
      ...prev,
      status_id: '',
      open: '',
      overdue: '',
      resolved_this_month: '',
    }));

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

  const hasAnyFilter = Object.values(filters).some(Boolean);
  const totalStatusCount = statusCounts.reduce(
    (sum, row) => sum + Number(row.count || 0),
    0
  );

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

      <section>
        <p className="section-label">Status Overview</p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-9">
          <StatusSummaryCard
            label="All"
            value={totalStatusCount}
            active={
              !filters.status_id &&
              !filters.open &&
              !filters.overdue &&
              !filters.resolved_this_month
            }
            onClick={showAllStatuses}
          />

          {statusCounts.map((status) => (
            <StatusSummaryCard
              key={status.status_id}
              label={status.status_name}
              value={status.count}
              active={String(filters.status_id) === String(status.status_id)}
              onClick={() => filterByStatus(status)}
            />
          ))}

          <StatusSummaryCard
            label="Overdue"
            value={overdueCount}
            active={filters.overdue === '1'}
            onClick={filterByOverdue}
          />
        </div>
      </section>

      <div className="card mb-4 flex flex-wrap items-start gap-3 p-4">
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
            Submitted By
          </label>

          <select
            name="my_submitted"
            value={filters.my_submitted}
            onChange={handleFilterChange}
            className="input-field py-1.5"
          >
            <option value="">All complaints</option>
            <option value="1">Complaints I submitted</option>
          </select>
        </div>

        <div className="flex min-w-[190px] flex-col gap-3">
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
        </div>

        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="btn-secondary mt-6 py-1.5"
          >
            {t('complaints.list.clearFilters')}
          </button>
        )}
      </div>

      {filters.my_submitted && (
        <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          Showing only complaints submitted by you.
        </div>
      )}

      {filters.overdue && (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Showing overdue complaints only.
        </div>
      )}

      {filters.open && (
        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Showing open complaints only.
        </div>
      )}

      {filters.resolved_this_month && (
        <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Showing complaints resolved this month.
        </div>
      )}

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
            <div className="overflow-x-auto">
              <table className="min-w-[1450px] divide-y divide-gray-200 text-sm">
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

                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                      Decision
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
                  {complaints.map((c) => {
                    const overdue = isOverdueComplaint(c);

                    return (
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
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge statusName={c.status_name} />

                            {overdue && (
                              <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="max-w-[170px] px-4 py-3 text-gray-600">
                          <span className="block text-xs leading-5">
                            {formatDecision(c)}
                          </span>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
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