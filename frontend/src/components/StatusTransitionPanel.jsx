/**
 * StatusTransitionPanel.jsx
 * Role-aware status transition panel.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { transitionComplaint } from '../api/complaints';
import useAuth from '../hooks/useAuth';

const TRANSITION_ROLES = ['Clerk', 'Director', 'Minister'];
const COMMENT_REQUIRED_STATUS_IDS = [5];

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.message ||
    err?.data?.message ||
    err?.message ||
    fallback
  );
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function isOwner(staff, complaint) {
  return Number(staff?.staff_id) === Number(complaint?.submitted_by);
}

function getAvailableStatusesForRole({ staff, complaint, statuses }) {
  if (!staff || !complaint) return [];

  const role = staff.role_name;
  const current = Number(complaint.status_id);
  const owner = isOwner(staff, complaint);

  let allowedIds = [];

  if (role === 'Clerk') {
    if (!owner) return [];

    if (current === 1) allowedIds = [2];
    if (current === 2) allowedIds = [3];
    if (current === 4) allowedIds = [6];
    if (current === 6) allowedIds = [7];
    if (current === 5) allowedIds = [1];
  }

  if (role === 'Director') {
    if (current === 1) allowedIds = [2];
    if (current === 2) allowedIds = [3];
    if (current === 3) allowedIds = [4, 5];
    if (current === 4) allowedIds = [5, 6];
    if (current === 5) allowedIds = [1, 4];
    if (current === 6) allowedIds = [7];
  }

  if (role === 'Minister') {
    if (current === 1) allowedIds = [2, 4, 5];
    if (current === 2) allowedIds = [3, 4, 5];
    if (current === 3) allowedIds = [4, 5];
    if (current === 4) allowedIds = [5, 6];
    if (current === 5) allowedIds = [1, 4];
    if (current === 6) allowedIds = [4, 5, 7];
    if (current === 7) allowedIds = [4, 5];
  }

  return statuses.filter((s) => allowedIds.includes(Number(s.status_id)));
}

function getRoleHint(staff, complaint) {
  const role = staff?.role_name;
  const currentStatus = normalize(complaint?.status_name);

  if (role === 'Clerk') {
    if (!isOwner(staff, complaint)) {
      return 'Only the clerk who submitted this complaint can move it through clerk workflow steps.';
    }

    if (currentStatus === 'rejected') {
      return 'You can return this rejected complaint to Submitted, edit it, and send it through the workflow again.';
    }

    return 'You can move your own complaint through review steps, and after a decision you can mark it Resolved and Closed.';
  }

  if (role === 'Director') {
    return 'Directors can review complaints, approve or reject them, and revise their own decisions unless a Minister decision exists.';
  }

  if (role === 'Minister') {
    return 'Ministers can make or override approval decisions, including Director decisions.';
  }

  return '';
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

  if (!TRANSITION_ROLES.includes(staff?.role_name)) return null;

  const availableStatuses = useMemo(
    () => getAvailableStatusesForRole({ staff, complaint, statuses }),
    [staff, complaint, statuses]
  );

  const commentRequired = COMMENT_REQUIRED_STATUS_IDS.includes(Number(toStatusId));
  const roleHint = getRoleHint(staff, complaint);

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
      setError(
        getErrorMessage(err, t('complaints.transition.errorGeneric'))
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (availableStatuses.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {t('complaints.transition.title')}
        </h2>

        <p className="text-sm text-gray-500">
          No workflow action is available for your role at this stage.
        </p>

        {roleHint && (
          <p className="mt-2 text-xs text-slate-400">
            {roleHint}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {t('complaints.transition.title')}
      </h2>

      {roleHint && (
        <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {roleHint}
        </p>
      )}

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