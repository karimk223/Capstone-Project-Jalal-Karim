// src/pages/Reports.jsx
// Reports page — 4 analytics charts using Recharts.
//
// Implements FR-15 (role-appropriate analytics dashboard).
// Addresses Gap 6 (no dashboard / no "my work" view in the legacy system —
// the legacy main screen was just a Ministry crest with no data).
//
// Charts:
//   1. Status Distribution    — PieChart  (countsByStatus)
//   2. Complaints by Category — BarChart  (countsByCategory)
//   3. Avg Resolution Time    — Stat card (averageResolutionTime)
//   4. Complaints per Staff   — BarChart  (complaintsPerStaff)

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

import {
  getCountsByStatus,
  getCountsByCategory,
  getAverageResolutionTime,
  getComplaintsPerStaff,
} from '../api/reports';
import { getErrorMessage } from '../utils/apiError';

// Color palette — ministry blue shades + accent colors
// Each status gets a distinct color so the pie is readable at a glance.
const STATUS_COLORS = [
  '#1d4ed8', // blue-700   Submitted
  '#0369a1', // sky-700    Under Review
  '#0f766e', // teal-700   Pending Approval
  '#15803d', // green-700  Approved
  '#b91c1c', // red-700    Rejected
  '#7e22ce', // purple-700 Resolved
  '#374151', // gray-700   Closed
];

const CATEGORY_COLOR = '#1d4ed8';
const STAFF_COLOR    = '#0369a1';

export default function Reports() {
  const { t } = useTranslation();

  // Each chart has its own loading/error/data state so one failure
  // doesn't blank the whole page (conventions §5.2: loading states always rendered).
  const [statusData,     setStatusData]     = useState([]);
  const [categoryData,   setCategoryData]   = useState([]);
  const [resolutionData, setResolutionData] = useState(null);
  const [staffData,      setStaffData]      = useState([]);

  const [loadingStatus,     setLoadingStatus]     = useState(true);
  const [loadingCategory,   setLoadingCategory]   = useState(true);
  const [loadingResolution, setLoadingResolution] = useState(true);
  const [loadingStaff,      setLoadingStaff]      = useState(true);

  const [errorStatus,     setErrorStatus]     = useState(null);
  const [errorCategory,   setErrorCategory]   = useState(null);
  const [errorResolution, setErrorResolution] = useState(null);
  const [errorStaff,      setErrorStaff]      = useState(null);

  // Fetch all 4 endpoints in parallel on mount.
  useEffect(() => {
    let active = true;

    async function fetchAll() {
      // ── Status pie ───────────────────────────────────────────────────────
      getCountsByStatus()
        .then((d) => { if (active) setStatusData(d); })
        .catch((e) => { if (active) setErrorStatus(getErrorMessage(e)); })
        .finally(() => { if (active) setLoadingStatus(false); });

      // ── Category bar ─────────────────────────────────────────────────────
      getCountsByCategory()
        .then((d) => { if (active) setCategoryData(d); })
        .catch((e) => { if (active) setErrorCategory(getErrorMessage(e)); })
        .finally(() => { if (active) setLoadingCategory(false); });

      // ── Resolution time stat ─────────────────────────────────────────────
      getAverageResolutionTime()
        .then((d) => { if (active) setResolutionData(d); })
        .catch((e) => { if (active) setErrorResolution(getErrorMessage(e)); })
        .finally(() => { if (active) setLoadingResolution(false); });

      // ── Complaints per staff bar ─────────────────────────────────────────
      getComplaintsPerStaff()
        .then((d) => { if (active) setStaffData(d); })
        .catch((e) => { if (active) setErrorStaff(getErrorMessage(e)); })
        .finally(() => { if (active) setLoadingStaff(false); });
    }

    fetchAll();
    return () => { active = false; };
  }, []);

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">
          {t('reports.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('reports.subtitle')}
        </p>
      </header>

      {/* ── Row 1: Status pie + Avg resolution stat ────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Chart 1 — Status Distribution pie */}
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            {t('reports.statusPieTitle')}
          </h2>
          <ChartShell loading={loadingStatus} error={errorStatus} empty={statusData.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="status_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ status_name, percent }) =>
                    `${status_name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {statusData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={STATUS_COLORS[i % STATUS_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value, name]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>

        {/* Chart 3 — Average Resolution Time stat card */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm flex flex-col justify-center">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            {t('reports.resolutionTitle')}
          </h2>
          {loadingResolution ? (
            <p className="text-sm text-gray-400">{t('common.loading')}</p>
          ) : errorResolution ? (
            <ErrorMessage message={errorResolution} />
          ) : (
            <div className="text-center">
              <p className="text-6xl font-bold text-ministry-700">
                {resolutionData?.average_resolution_days ?? '—'}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {t('reports.resolutionUnit')}
              </p>
              {resolutionData?.average_resolution_days === null && (
                <p className="mt-3 text-xs text-gray-400">
                  {t('reports.resolutionNoData')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Category bar ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          {t('reports.categoryBarTitle')}
        </h2>
        <ChartShell loading={loadingCategory} error={errorCategory} empty={categoryData.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 12 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill={CATEGORY_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      {/* ── Row 3: Complaints per staff bar ───────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          {t('reports.staffBarTitle')}
        </h2>
        <ChartShell loading={loadingStaff} error={errorStaff} empty={staffData.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={staffData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="full_name"
                tick={{ fontSize: 12 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, _name, props) => [
                  value,
                  `${props.payload.role_name}`,
                ]}
              />
              <Bar dataKey="complaint_count" fill={STAFF_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>
    </div>
  );
}

/**
 * ChartShell
 * Wraps every chart with consistent loading / error / empty states.
 * Per coding-conventions.md §5.2: "no component silently fails."
 */
function ChartShell({ loading, error, empty, children }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (empty) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-gray-400">{t('reports.noData')}</p>
      </div>
    );
  }

  return children;
}

function ErrorMessage({ message }) {
  return (
    <div className="rounded border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}
