/**
 * src/pages/Dashboard.jsx
 * Updated:
 * - Removed "Open Complaints"
 * - Removed bottom "Quick Actions"
 * - Kept clickable overview cards
 * - Overdue card links to complaints page with overdue filter applied
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getDashboardSummary } from '../api/dashboard';
import useAuth from '../hooks/useAuth';

function CountCard({ label, value, tone, onClick }) {
  const tones = {
    slate:
      'from-slate-50 to-white text-slate-700 ring-slate-100 hover:ring-slate-200',
    yellow:
      'from-amber-50 to-white text-amber-700 ring-amber-100 hover:ring-amber-200',
    red:
      'from-red-50 to-white text-red-700 ring-red-100 hover:ring-red-200',
    green:
      'from-emerald-50 to-white text-emerald-700 ring-emerald-100 hover:ring-emerald-200',
    violet:
      'from-violet-50 to-white text-violet-700 ring-violet-100 hover:ring-violet-200',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card card-hover w-full overflow-hidden bg-gradient-to-br p-5 text-left ring-1 transition ${
        tones[tone] || tones.slate
      }`}
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
          Live
        </span>
        <span className="h-9 w-9 rounded-2xl bg-current opacity-10" />
      </div>

      <p className="text-4xl font-black tracking-tight text-slate-950">
        {value ?? '—'}
      </p>

      <p className="mt-2 text-sm font-medium text-slate-500">{label}</p>
    </button>
  );
}

function LoadingCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="card h-36 animate-pulse bg-slate-100/80" />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { staff } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch((err) => setError(err.message || 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  function buildCards(counts) {
    return [
      {
        label: 'Total Complaints',
        value: counts.total_complaints,
        tone: 'slate',
        onClick: () => navigate('/complaints'),
      },
      {
        label: 'Pending Approvals',
        value: counts.pending_approvals,
        tone: 'yellow',
        onClick: () => navigate('/approvals'),
      },
      {
        label: 'Overdue',
        value: counts.total_overdue,
        tone: 'red',
        onClick: () => navigate('/complaints?overdue=1'),
      },
      {
        label: 'Resolved This Month',
        value: counts.resolved_this_month,
        tone: 'green',
        onClick: () => navigate('/complaints?resolved_this_month=1'),
      },
      {
        label: 'Reports',
        value: '↗',
        tone: 'violet',
        onClick: () => navigate('/reports'),
      },
    ];
  }

  function formatDateTime(iso) {
    if (!iso) return '—';

    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="page-shell">
      <div className="page-header overflow-hidden bg-gradient-to-br from-white via-white to-blue-50">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-ministry-700">
              Dashboard
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {t('dashboard.welcome', { name: staff?.full_name })}
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {t('dashboard.roleLabel', { role: staff?.role_name })} — monitor
              complaints, approvals, reports, and recent workflow activity from
              one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/complaints/new')}
            className="btn-primary"
          >
            + New Complaint
          </button>
        </div>
      </div>

      {loading && <LoadingCards />}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && summary && (
        <>
          <section>
            <p className="section-label">Overview</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {buildCards(summary.counts).map((card) => (
                <CountCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  tone={card.tone}
                  onClick={card.onClick}
                />
              ))}
            </div>
          </section>

          {summary.recent_activity?.length > 0 && (
            <section>
              <p className="section-label">Recent Activity</p>

              <div className="card divide-y divide-slate-100 overflow-hidden">
                {summary.recent_activity.map((entry) => (
                  <button
                    key={entry.tracking_id}
                    type="button"
                    onClick={() => navigate(`/complaints/${entry.complaint_id}`)}
                    className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {entry.from_status
                          ? `${entry.from_status} → ${entry.to_status}`
                          : entry.to_status}
                        <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                          #{entry.complaint_id}
                        </span>
                      </p>

                      {entry.notes && (
                        <p className="mt-1 max-w-xl truncate text-sm text-slate-500">
                          {entry.notes}
                        </p>
                      )}

                      <p className="mt-1 text-xs text-slate-400">
                        by {entry.changed_by_name}
                      </p>
                    </div>

                    <span className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                      {formatDateTime(entry.changed_at)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}