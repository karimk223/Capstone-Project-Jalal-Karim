// src/pages/Reports.jsx
// Reports page — 4 analytics charts using Recharts.
//
// Implements FR-15 (role-appropriate analytics dashboard).
// Addresses Gap 6 (no dashboard / no "my work" view in the legacy system).
//
// Updated:
//   - Fixed pie chart label overlap by removing outside labels
//   - Added cleaner tooltip with percentage
//   - Moved legend below the chart with better spacing
//   - Enlarged chart container height for better readability

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

import {
  getCountsByStatus,
  getCountsByCategory,
  getAverageResolutionTime,
  getComplaintsPerStaff,
} from '../api/reports';
import { getErrorMessage } from '../utils/apiError';

const STATUS_COLORS = [
  '#1d4ed8', // Submitted
  '#0369a1', // Under Review
  '#0f766e', // Pending Approval
  '#15803d', // Approved
  '#b91c1c', // Rejected
  '#7e22ce', // Resolved
  '#374151', // Closed
];

const CATEGORY_COLOR = '#1d4ed8';
const STAFF_COLOR = '#0369a1';

function formatPercent(value, total) {
  if (!total) return '0%';
  return `${Math.round((Number(value) / total) * 100)}%`;
}

export default function Reports() {
  const { t } = useTranslation();

  const [statusData, setStatusData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [resolutionData, setResolutionData] = useState(null);
  const [staffData, setStaffData] = useState([]);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingCategory, setLoadingCategory] = useState(true);
  const [loadingResolution, setLoadingResolution] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);

  const [errorStatus, setErrorStatus] = useState(null);
  const [errorCategory, setErrorCategory] = useState(null);
  const [errorResolution, setErrorResolution] = useState(null);
  const [errorStaff, setErrorStaff] = useState(null);

  useEffect(() => {
    let active = true;

    getCountsByStatus()
      .then((d) => {
        if (active) setStatusData(d);
      })
      .catch((e) => {
        if (active) setErrorStatus(getErrorMessage(e));
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });

    getCountsByCategory()
      .then((d) => {
        if (active) setCategoryData(d);
      })
      .catch((e) => {
        if (active) setErrorCategory(getErrorMessage(e));
      })
      .finally(() => {
        if (active) setLoadingCategory(false);
      });

    getAverageResolutionTime()
      .then((d) => {
        if (active) setResolutionData(d);
      })
      .catch((e) => {
        if (active) setErrorResolution(getErrorMessage(e));
      })
      .finally(() => {
        if (active) setLoadingResolution(false);
      });

    getComplaintsPerStaff()
      .then((d) => {
        if (active) setStaffData(d);
      })
      .catch((e) => {
        if (active) setErrorStaff(getErrorMessage(e));
      })
      .finally(() => {
        if (active) setLoadingStaff(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const statusTotal = statusData.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0
  );

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            {t('reports.statusPieTitle')}
          </h2>

          <ChartShell
            loading={loadingStatus}
            error={errorStatus}
            empty={statusData.length === 0}
          >
            <ResponsiveContainer width="100%" height={330}>
              <PieChart margin={{ top: 8, right: 8, bottom: 32, left: 8 }}>
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="status_name"
                  cx="50%"
                  cy="43%"
                  outerRadius={105}
                  label={false}
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
                  formatter={(value, name) => [
                    `${value} complaints (${formatPercent(value, statusTotal)})`,
                    name,
                  ]}
                />

                <Legend
                  verticalAlign="bottom"
                  align="center"
                  height={54}
                  iconType="square"
                  wrapperStyle={{
                    fontSize: 13,
                    paddingTop: 12,
                    lineHeight: '22px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>

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

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          {t('reports.categoryBarTitle')}
        </h2>

        <ChartShell
          loading={loadingCategory}
          error={errorCategory}
          empty={categoryData.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={categoryData}
              margin={{ top: 4, right: 16, left: 0, bottom: 60 }}
            >
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

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          {t('reports.staffBarTitle')}
        </h2>

        <ChartShell
          loading={loadingStaff}
          error={errorStaff}
          empty={staffData.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={staffData}
              margin={{ top: 4, right: 16, left: 0, bottom: 60 }}
            >
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

              <Bar
                dataKey="complaint_count"
                fill={STAFF_COLOR}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>
    </div>
  );
}

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