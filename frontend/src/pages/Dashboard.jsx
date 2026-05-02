/**
 * src/pages/Dashboard.jsx
 * Implements FR-15 (role-specific dashboard counts).
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import useAuth from '../hooks/useAuth';

function CountCard({ label, value, tone, onClick }) {
  const tones = {
    blue: 'from-blue-50 to-white text-blue-700 ring-blue-100',
    red: 'from-red-50 to-white text-red-700 ring-red-100',
    green: 'from-emerald-50 to-white text-emerald-700 ring-emerald-100',
    yellow: 'from-amber-50 to-white text-amber-700 ring-amber-100',
    slate: 'from-slate-50 to-white text-slate-700 ring-slate-100',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`card card-hover w-full overflow-hidden bg-gradient-to-br p-5 text-left ring-1 ${tones[tone] || tones.slate} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">Live</span>
        <span className="h-9 w-9 rounded-2xl bg-current opacity-10" />
      </div>
      <p className="text-4xl font-black tracking-tight text-slate-950">{value ?? '—'}</p>
      <p className="mt-2 text-sm font-medium text-slate-500">{label}</p>
    </button>
  );
}

function LoadingCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {[1, 2, 3, 4, 5].map(i => <div key={i} className="card h-36 animate-pulse bg-slate-100/80" />)}
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
    apiClient.get('/api/v1/dashboard/summary')
      .then(res => setSummary(res.data))
      .catch(err => setError(err.message || 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  const role = staff?.role_name;
  const actions = [
    { label: t('dashboard.actionComplaints'), description: t('dashboard.actionComplaintsDesc'), onClick: () => navigate('/complaints'), roles: null, tone: 'border-blue-100 bg-blue-50/70 text-blue-800' },
    { label: t('dashboard.actionNew'), description: t('dashboard.actionNewDesc'), onClick: () => navigate('/complaints/new'), roles: ['Clerk', 'Director', 'Admin'], tone: 'border-emerald-100 bg-emerald-50/70 text-emerald-800' },
    { label: t('dashboard.actionApprovals'), description: t('dashboard.actionApprovalsDesc'), onClick: () => navigate('/approvals'), roles: ['Director', 'Minister', 'Admin'], tone: 'border-amber-100 bg-amber-50/70 text-amber-800' },
    { label: t('dashboard.actionReports'), description: t('dashboard.actionReportsDesc'), onClick: () => navigate('/reports'), roles: null, tone: 'border-violet-100 bg-violet-50/70 text-violet-800' },
  ].filter(a => a.roles === null || a.roles.includes(role));

  function buildCards(counts, roleId) {
    if (roleId === 2) {
      return [
        { label: 'My Open Complaints', value: counts.my_open, tone: 'blue' },
        { label: 'My Overdue', value: counts.my_overdue, tone: 'red' },
        { label: 'Submitted This Month', value: counts.my_submitted_this_month, tone: 'green' },
      ];
    }
    if (roleId === 3) {
      return [
        { label: 'Open Complaints', value: counts.total_open, tone: 'blue' },
        { label: 'Pending Approvals', value: counts.pending_approvals, tone: 'yellow', filter: '/approvals' },
        { label: 'Overdue', value: counts.total_overdue, tone: 'red' },
      ];
    }
    return [
      { label: 'Total Complaints', value: counts.total_complaints, tone: 'slate' },
      { label: 'Open Complaints', value: counts.total_open, tone: 'blue' },
      { label: 'Pending Approvals', value: counts.pending_approvals, tone: 'yellow', filter: '/approvals' },
      { label: 'Overdue', value: counts.total_overdue, tone: 'red' },
      { label: 'Resolved This Month', value: counts.resolved_this_month, tone: 'green' },
    ];
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="page-shell">
      <div className="page-header overflow-hidden bg-gradient-to-br from-white via-white to-blue-50">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-ministry-700">Dashboard</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {t('dashboard.welcome', { name: staff?.full_name })}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {t('dashboard.roleLabel', { role: staff?.role_name })} — monitor complaints, approvals, and recent workflow activity from one place.
            </p>
          </div>
          <button type="button" onClick={() => navigate('/complaints/new')} className="btn-primary">
            + New Complaint
          </button>
        </div>
      </div>

      {loading && <LoadingCards />}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700 shadow-sm">{error}</div>
      )}

      {!loading && !error && summary && (
        <>
          <section>
            <p className="section-label">Overview</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {buildCards(summary.counts, summary.role_id).map(card => (
                <CountCard key={card.label} label={card.label} value={card.value} tone={card.tone} onClick={card.filter ? () => navigate(card.filter) : undefined} />
              ))}
            </div>
          </section>

          {summary.recent_activity?.length > 0 && (
            <section>
              <p className="section-label">Recent Activity</p>
              <div className="card divide-y divide-slate-100 overflow-hidden">
                {summary.recent_activity.map(entry => (
                  <button key={entry.tracking_id} type="button" onClick={() => navigate(`/complaints/${entry.complaint_id}`)} className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {entry.from_status ? `${entry.from_status} → ${entry.to_status}` : entry.to_status}
                        <span className="ml-2 font-mono text-xs font-normal text-slate-400">#{entry.complaint_id}</span>
                      </p>
                      {entry.notes && <p className="mt-1 max-w-xl truncate text-sm text-slate-500">{entry.notes}</p>}
                      <p className="mt-1 text-xs text-slate-400">by {entry.changed_by_name}</p>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">{formatDateTime(entry.changed_at)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section>
        <p className="section-label">Quick Actions</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(action => (
            <button key={action.label} type="button" onClick={action.onClick} className={`card card-hover border p-5 text-left ${action.tone}`}>
              <p className="text-sm font-bold">{action.label}</p>
              <p className="mt-2 text-xs leading-5 opacity-80">{action.description}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
