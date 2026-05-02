/**
 * src/components/StatusTransitionPanel.jsx
 * Implements FR-11 (status transitions), FR-12 (invalid transition rejection),
 * FR-13 (comment required for rejection), FR-14 (terminal status guard).
 * Addresses Gap 1 (no status field in legacy), Gap 6 (workflow enforcement).
 *
 * RBAC: only Directors, Ministers, and Admins see this panel (Gap 5).
 * The server still enforces the role check — this is a UX improvement only.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { transitionComplaint } from '../api/complaints';
import useAuth from '../hooks/useAuth';

// Roles that are allowed to trigger transitions (client-side gate).
// Server enforces this authoritatively (Gap 5).
const TRANSITION_ROLES = ['Director', 'Minister', 'Admin'];

// Status IDs that require a comment (api-spec.md: rejections require comment).
const COMMENT_REQUIRED_STATUS_IDS = [5]; // 5 = Rejected

export default function StatusTransitionPanel({ complaint, statuses, onTransitionDone }) {
  const { t } = useTranslation();
  const { staff } = useAuth();

  const [toStatusId, setToStatusId]   = useState('');
  const [comment, setComment]         = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  // Don't render for Clerks — they can't transition (Gap 5 / FR-11).
  if (!TRANSITION_ROLES.includes(staff?.role_name)) return null;

  // Don't render if the complaint is in a terminal status (FR-14).
  const currentStatus = statuses.find((s) => s.status_id === complaint.status_id);
  if (currentStatus?.is_terminal) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">
          {t('complaints.transition.terminalMessage')}
        </p>
      </div>
    );
  }

  // Available target statuses — all except the current one.
  const availableStatuses = statuses.filter(
    (s) => s.status_id !== complaint.status_id
  );

  const commentRequired = COMMENT_REQUIRED_STATUS_IDS.includes(Number(toStatusId));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!toStatusId) {
      setError(t('complaints.transition.errorSelectStatus'));
      return;
    }
    if (commentRequired && !comment.trim()) {
      setError(t('complaints.transition.errorCommentRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await transitionComplaint(complaint.complaint_id, Number(toStatusId), comment.trim());
      setSuccess(t('complaints.transition.success'));
      setToStatusId('');
      setComment('');
      // Tell the parent (ComplaintDetail) to reload the complaint + timeline.
      onTransitionDone();
    } catch (err) {
      // Map known backend error codes to friendly messages (Gap 7).
      if (err.code === 'INVALID_TRANSITION') {
        setError(t('complaints.transition.errorInvalidTransition'));
      } else if (err.code === 'TERMINAL_STATUS') {
        setError(t('complaints.transition.errorTerminal'));
      } else {
        setError(err.message || t('complaints.transition.errorGeneric'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {t('complaints.transition.title')}
      </h2>

      {success && (
        <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Status dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('complaints.transition.labelNewStatus')}
          </label>
          <select
            value={toStatusId}
            onChange={(e) => { setToStatusId(e.target.value); setError(''); }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">{t('complaints.transition.selectStatus')}</option>
            {availableStatuses.map((s) => (
              <option key={s.status_id} value={s.status_id}>
                {s.status_name}
              </option>
            ))}
          </select>
        </div>

        {/* Comment — always visible, required only for Rejection (FR-13) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('complaints.transition.labelComment')}
            {commentRequired && <span className="ml-1 text-red-500">*</span>}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={t('complaints.transition.placeholderComment')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !toStatusId}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? t('complaints.transition.submitting')
              : t('complaints.transition.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
