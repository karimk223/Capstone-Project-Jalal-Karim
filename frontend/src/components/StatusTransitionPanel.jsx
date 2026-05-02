/**
 * src/components/StatusTransitionPanel.jsx
 * Implements FR-11 (status transitions), FR-12 (invalid transition rejection),
 * FR-13 (comment required for rejection), FR-14 (terminal status guard).
 * Addresses Gap 1 (no status field in legacy), Gap 6 (workflow enforcement).
 *
 * Updated:
 * - Shows clear backend workflow error messages instead of generic "Request failed"
 * - Keeps all statuses in dropdown except the current one
 * - Keeps RBAC client-side gate for Director, Minister, and Admin
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { transitionComplaint } from '../api/complaints';
import useAuth from '../hooks/useAuth';

const TRANSITION_ROLES = ['Director', 'Minister', 'Admin'];
const COMMENT_REQUIRED_STATUS_IDS = [5]; // 5 = Rejected

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.message ||
    err?.data?.message ||
    err?.message ||
    fallback
  );
}

export default function StatusTransitionPanel({
  complaint,
  statuses,
  onTransitionDone,
}) {
  const { t } = useTranslation();
  const { staff } = useAuth();

  const [toStatusId, setToStatusId] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Don't render for Clerks.
  if (!TRANSITION_ROLES.includes(staff?.role_name)) return null;

  const currentStatus = statuses.find(
    (s) => Number(s.status_id) === Number(complaint.status_id)
  );

  if (currentStatus?.is_terminal) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">
          {t('complaints.transition.terminalMessage')}
        </p>
      </div>
    );
  }

  // Keep all possible statuses except current one.
  // Invalid choices are handled by the backend and displayed clearly.
  const availableStatuses = statuses.filter(
    (s) => Number(s.status_id) !== Number(complaint.status_id)
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
      await transitionComplaint(
        complaint.complaint_id,
        Number(toStatusId),
        comment.trim()
      );

      setSuccess(t('complaints.transition.success'));
      setToStatusId('');
      setComment('');

      if (onTransitionDone) {
        await onTransitionDone();
      }
    } catch (err) {
      const backendMessage = getErrorMessage(
        err,
        t('complaints.transition.errorGeneric')
      );

      setError(backendMessage);
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
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('complaints.transition.labelNewStatus')}
          </label>

          <select
            value={toStatusId}
            onChange={(e) => {
              setToStatusId(e.target.value);
              setError('');
              setSuccess('');
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">
              {t('complaints.transition.selectStatus')}
            </option>

            {availableStatuses.map((s) => (
              <option key={s.status_id} value={s.status_id}>
                {s.status_name}
              </option>
            ))}
          </select>
        </div>

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