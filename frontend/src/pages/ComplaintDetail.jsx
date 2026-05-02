/**
 * src/pages/ComplaintDetail.jsx
 * Implements FR-11-14 (workflow), FR-19-20 (audit trail), FR-7 (attachments).
 *
 * Updated:
 * - Fixed Status Journey branching
 * - Fixed status journey circles so they remain perfectly circular
 * - Fixed status journey connector line to be clean and continuous
 * - Fixed cropped circle rings by adding top padding
 * - Added Overdue badge without replacing the real workflow status
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getComplaintById,
  getComplaintTracking,
  getComplaintAttachments,
  getAttachmentDownloadUrl,
  uploadAttachment,
} from '../api/complaints';
import { getStatuses } from '../api/lookups';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import StatusTransitionPanel from '../components/StatusTransitionPanel';
import useAuth from '../hooks/useAuth';
import { getStatusTheme } from '../utils/statusTheme';

function formatDate(iso) {
  if (!iso) return '—';

  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

function DetailRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-medium text-slate-900">
        {value ?? '—'}
      </dd>
    </div>
  );
}

function SectionCard({ title, count, children, actions }) {
  return (
    <section className="card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            {title}
          </h2>

          {typeof count === 'number' && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {count}
            </span>
          )}
        </div>

        {actions}
      </div>

      {children}
    </section>
  );
}

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function AttachmentUploadPanel({ complaintId, onUploaded }) {
  const { t } = useTranslation();

  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleFileChange(e) {
    setError('');
    setSuccess(false);

    const selected = e.target.files[0];

    if (!selected) {
      setFile(null);
      return;
    }

    if (!ALLOWED_MIME.includes(selected.type)) {
      setError(t('complaints.form.errors.fileType'));
      setFile(null);
      return;
    }

    if (selected.size > MAX_FILE_BYTES) {
      setError(t('complaints.form.errors.fileSize'));
      setFile(null);
      return;
    }

    setFile(selected);
  }

  async function handleUpload() {
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      await uploadAttachment(complaintId, file);
      setSuccess(true);
      setFile(null);

      const input = document.getElementById(`attach-input-${complaintId}`);
      if (input) input.value = '';

      if (onUploaded) onUploaded();
    } catch (err) {
      setError(err.message || t('complaints.form.errors.submitFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50/70 p-4">
      <p className="text-sm font-semibold text-slate-800">Upload a file</p>

      <p className="mt-1 text-xs text-slate-500">
        PDF, JPG, and PNG files up to 10 MB.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          id={`attach-input-${complaintId}`}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          className="block text-sm text-slate-600 file:mr-3 file:rounded-xl file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
        />

        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || loading}
          className="btn-primary"
        >
          {loading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {success && (
        <p className="mt-3 text-sm text-emerald-600">
          File uploaded successfully.
        </p>
      )}
    </div>
  );
}

function ComplaintJourney({ statuses, currentStatusName, tracking = [] }) {
  const normalize = (value) => String(value || '').trim().toLowerCase();

  const normalizedCurrent = normalize(currentStatusName);

  const statusByName = new Map(
    statuses.map((status) => [normalize(status.status_name), status])
  );

  const rejectedFlow = [
    'submitted',
    'under review',
    'pending approval',
    'rejected',
  ];

  const approvedFlow = [
    'submitted',
    'under review',
    'pending approval',
    'approved',
    'resolved',
    'closed',
  ];

  const defaultFlow = [
    'submitted',
    'under review',
    'pending approval',
    'approved',
    'resolved',
    'closed',
  ];

  let flowNames = defaultFlow;

  if (normalizedCurrent === 'rejected') {
    flowNames = rejectedFlow;
  } else if (
    normalizedCurrent === 'approved' ||
    normalizedCurrent === 'resolved' ||
    normalizedCurrent === 'closed'
  ) {
    flowNames = approvedFlow;
  }

  const ordered = flowNames
    .map((name) => statusByName.get(name))
    .filter(Boolean);

  const visited = new Set();

  tracking.forEach((entry) => {
    if (entry.from_status_name) {
      visited.add(normalize(entry.from_status_name));
    }

    if (entry.to_status_name) {
      visited.add(normalize(entry.to_status_name));
    }
  });

  if (normalizedCurrent) {
    visited.add(normalizedCurrent);
  }

  const currentIndex = ordered.findIndex(
    (status) => normalize(status.status_name) === normalizedCurrent
  );

  if (ordered.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto pb-2 pt-3">
      <div className="relative min-w-[920px] px-6 pt-2">
        <div className="absolute left-[74px] right-[74px] top-9 h-1 rounded-full bg-slate-200" />

        <div className="relative z-10 grid grid-flow-col auto-cols-fr items-start gap-6">
          {ordered.map((status, index) => {
            const theme = getStatusTheme(status.status_name);
            const normalizedStatus = normalize(status.status_name);

            const isCurrent = normalizedStatus === normalizedCurrent;

            const isCompleted =
              !isCurrent &&
              (
                visited.has(normalizedStatus) ||
                (currentIndex >= 0 && index < currentIndex)
              );

            const isUpcoming = !isCurrent && !isCompleted;

            return (
              <div
                key={status.status_id}
                className="flex min-w-[120px] flex-col items-center text-center"
              >
                <div
                  className={`flex h-14 w-14 min-h-[56px] min-w-[56px] shrink-0 items-center justify-center rounded-full text-base font-bold shadow-sm ring-4 ${
                    isCurrent || isCompleted
                      ? `${theme.step} ${theme.ring}`
                      : 'bg-slate-100 text-slate-500 ring-slate-100'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>

                <p
                  className={`mt-3 min-h-[32px] text-xs font-semibold uppercase leading-4 tracking-[0.14em] ${
                    isCurrent ? theme.accent : 'text-slate-500'
                  }`}
                >
                  {status.status_name}
                </p>

                <p className="mt-1 text-[11px] text-slate-400">
                  {isCurrent
                    ? 'Current'
                    : isCompleted
                      ? 'Completed'
                      : isUpcoming
                        ? 'Upcoming'
                        : 'Stage'}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ComplaintDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { staff } = useAuth();

  const [complaint, setComplaint] = useState(null);
  const [tracking, setTracking] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [comp, track, attach, sts] = await Promise.all([
        getComplaintById(id),
        getComplaintTracking(id),
        getComplaintAttachments(id),
        getStatuses(),
      ]);

      setComplaint(comp);
      setTracking(track);
      setAttachments(attach);
      setStatuses(sts);
    } catch (err) {
      setError(err.message || t('complaints.detail.errorLoading'));
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const currentTheme = useMemo(
    () => getStatusTheme(complaint?.status_name),
    [complaint?.status_name]
  );

  if (isLoading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        {t('app.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!complaint) return null;

  const canUpload = staff && [1, 2, 3].includes(staff.role_id);
  const overdue = isOverdueComplaint(complaint);

  return (
    <div className="page-shell">
      <div className={`page-header overflow-hidden bg-gradient-to-br ${currentTheme.soft}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white"
            >
              <span>←</span> Back
            </button>

            <p className="font-mono text-xs text-slate-400">
              Complaint #{complaint.complaint_id}
              {complaint.file_number ? ` • ${complaint.file_number}` : ''}
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {complaint.title}
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {complaint.description || 'No description provided for this complaint.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge statusName={complaint.status_name} />
            <PriorityBadge priority={complaint.priority} />

            {overdue && (
              <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
                Overdue
              </span>
            )}
          </div>
        </div>
      </div>

      <SectionCard title="Status Journey">
        <ComplaintJourney
          statuses={statuses}
          currentStatusName={complaint.status_name}
          tracking={tracking}
        />
      </SectionCard>

      <SectionCard title="Details">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DetailRow label="File Number" value={complaint.file_number} />
          <DetailRow label="Department" value={complaint.department_name} />
          <DetailRow label="Complaint Type" value={complaint.type_name} />
          <DetailRow label="Category" value={complaint.category} />
          <DetailRow label="Submitted by" value={complaint.submitted_by_name} />
          <DetailRow label="Complaint Date" value={formatDate(complaint.submitted_at)} />
          <DetailRow label="Deadline" value={formatDate(complaint.completion_deadline)} />

          {complaint.citizen_name && (
            <>
              <DetailRow label="Citizen" value={complaint.citizen_name} />
              <DetailRow label="Citizen ID" value={complaint.citizen_national_id} />
            </>
          )}

          {complaint.resolved_at && (
            <DetailRow label="Resolved" value={formatDate(complaint.resolved_at)} />
          )}
        </dl>
      </SectionCard>

      <StatusTransitionPanel
        complaint={complaint}
        statuses={statuses}
        onTransitionDone={loadAll}
      />

      <SectionCard title="Attachments" count={attachments.length}>
        {attachments.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50/70 py-10 text-center text-sm text-slate-500">
            No attachments uploaded yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {attachments.map((att) => (
              <li
                key={att.attachment_id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[1.1rem] border border-slate-200 bg-slate-50/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {att.file_name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {att.file_size_kb} KB • {att.uploaded_by_name} • {formatDate(att.uploaded_at)}
                  </p>
                </div>

                <a
                  href={getAttachmentDownloadUrl(att.attachment_id)}
                  download={att.file_name}
                  className="btn-secondary py-2 text-xs"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}

        {canUpload && (
          <AttachmentUploadPanel
            complaintId={complaint.complaint_id}
            onUploaded={loadAll}
          />
        )}
      </SectionCard>

      <SectionCard title="Activity Timeline" count={tracking.length}>
        {tracking.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50/70 py-10 text-center text-sm text-slate-500">
            No activity recorded yet.
          </div>
        ) : (
          <ol className="relative ml-3 border-l border-slate-200 pl-7">
            {tracking.map((entry) => {
              const theme = getStatusTheme(entry.to_status_name);

              return (
                <li key={entry.tracking_id} className="relative mb-7 last:mb-0">
                  <span
                    className={`absolute -left-[2.15rem] top-1 h-4 w-4 rounded-full border-4 border-white shadow ${theme.dot}`}
                  />

                  <div
                    className={`rounded-[1.15rem] border bg-gradient-to-br p-4 ${theme.line} ${theme.soft}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-slate-400">
                          {formatDateTime(entry.changed_at)} • {entry.changed_by_name}
                        </p>

                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {entry.from_status_name
                            ? `${entry.from_status_name} → ${entry.to_status_name}`
                            : entry.to_status_name}
                        </p>
                      </div>

                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme.badge}`}>
                        {entry.to_status_name}
                      </span>
                    </div>

                    {entry.notes && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}