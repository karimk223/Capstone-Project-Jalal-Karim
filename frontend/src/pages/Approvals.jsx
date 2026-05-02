/**
 * src/pages/Approvals.jsx
 * Polished approvals queue view.
 * Implements FR-11 (workflow transitions), FR-13 (comment required for rejection).
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getPendingApprovals, approveComplaint, rejectComplaint } from '../api/approvals';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import useAuth from '../hooks/useAuth';

const APPROVER_ROLES = ['Director', 'Minister', 'Admin'];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function StatCard({ label, value, hint }) {
  return (
    <div className="card bg-gradient-to-br from-white to-slate-50 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export default function Approvals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { staff } = useAuth();

  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [rowState, setRowState] = useState({});

  const canApprove = APPROVER_ROLES.includes(staff?.role_name);

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getPendingApprovals();
      setComplaints(result.data || []);
    } catch (err) {
      setError(err.message || t('approvals.errorLoading'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { loadPending(); }, [loadPending]);

  function getRow(id) {
    return rowState[id] || { isSubmitting: false, comment: '' };
  }

  function setRow(id, patch) {
    setRowState((prev) => ({ ...prev, [id]: { ...getRow(id), ...patch } }));
  }

  async function handleApprove(complaintId) {
    const row = getRow(complaintId);
    setRow(complaintId, { isSubmitting: true });
    try {
      await approveComplaint(complaintId, row.comment);
      toast.success(t('approvals.approveSuccess'));
      await loadPending();
    } catch (err) {
      toast.error(err.message || t('approvals.errorApprove'));
    } finally {
      setRow(complaintId, { isSubmitting: false });
    }
  }

  async function handleReject(complaintId) {
    const row = getRow(complaintId);
    if (!row.comment.trim()) {
      toast.error(t('approvals.commentRequired'));
      return;
    }
    setRow(complaintId, { isSubmitting: true });
    try {
      await rejectComplaint(complaintId, row.comment.trim());
      toast.success(t('approvals.rejectSuccess'));
      await loadPending();
    } catch (err) {
      toast.error(err.message || t('approvals.errorReject'));
    } finally {
      setRow(complaintId, { isSubmitting: false });
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header overflow-hidden bg-gradient-to-br from-white via-white to-violet-50/60">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-ministry-700">Approval Queue</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              {t('approvals.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">{t('approvals.subtitle')}</p>
          </div>
          <button type="button" onClick={loadPending} className="btn-secondary">
            Refresh queue
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Pending" value={complaints.length} hint="Complaints awaiting a decision" />
        <StatCard label="Your Role" value={staff?.role_name || '—'} hint="Current approval permissions" />
        <StatCard label="Status" value={canApprove ? 'Active' : 'View only'} hint={canApprove ? 'You can approve and reject complaints' : 'You do not have approval access'} />
      </div>

      {isLoading && (
        <div className="card py-14 text-center text-sm text-slate-500">{t('common.loading')}</div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && complaints.length === 0 && (
        <div className="card border-dashed py-16 text-center">
          <p className="text-sm font-semibold text-slate-900">{t('approvals.emptyTitle')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('approvals.emptyHint')}</p>
        </div>
      )}

      {!isLoading && !error && complaints.length > 0 && (
        <div className="space-y-5">
          {complaints.map((c) => {
            const row = getRow(c.complaint_id);
            return (
              <div key={c.complaint_id} className="card overflow-hidden border border-slate-200/90 bg-white">
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/complaints/${c.complaint_id}`)}
                        className="font-mono text-xs text-slate-400 transition hover:text-ministry-700 hover:underline"
                      >
                        #{c.complaint_id}
                      </button>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{c.title}</h2>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1">{c.department_name || '—'}</span>
                        <span>Submitted by {c.submitted_by_name}</span>
                        <span className="text-slate-300">•</span>
                        <span>{formatDate(c.submitted_at)}</span>
                      </div>
                      {c.description && (
                        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 line-clamp-2">{c.description}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge statusName={c.status_name} />
                      <PriorityBadge priority={c.priority} />
                    </div>
                  </div>
                </div>

                {canApprove && (
                  <div className="px-6 py-5">
                    <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50/70 p-4">
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Decision note
                      </label>
                      <textarea
                        value={row.comment}
                        onChange={(e) => setRow(c.complaint_id, { comment: e.target.value })}
                        placeholder={t('approvals.commentPlaceholder')}
                        rows={3}
                        className="input-field min-h-[110px] resize-y bg-white"
                      />
                      <p className="mt-2 text-xs text-slate-400">A comment is required for rejection and optional for approval.</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleApprove(c.complaint_id)}
                        disabled={row.isSubmitting}
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {row.isSubmitting ? t('common.loading') : t('approvals.approve')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(c.complaint_id)}
                        disabled={row.isSubmitting}
                        className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {row.isSubmitting ? t('common.loading') : t('approvals.reject')}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/complaints/${c.complaint_id}`)}
                        className="btn-secondary"
                      >
                        {t('approvals.viewDetails')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
