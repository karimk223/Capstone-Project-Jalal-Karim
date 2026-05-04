/**
 * src/pages/ComplaintDetail.jsx
 * Implements complaint detail, workflow, audit trail, attachments, and role-aware editing.
 *
 * Updated:
 * - File number is read-only in edit mode
 * - File number is not sent in update payload
 * - Complaint edit form can link/remove/create a citizen
 * - New citizen phone field accepts numbers only
 * - Fixed Status Journey: future states no longer stay colored after moving backward
 * - Shows latest dynamic approval/rejection decision and actor
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
  updateComplaint,
} from '../api/complaints';
import { getStatuses, getDepartments, getComplaintTypes } from '../api/lookups';
import apiClient from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import StatusTransitionPanel from '../components/StatusTransitionPanel';
import useAuth from '../hooks/useAuth';
import { getStatusTheme } from '../utils/statusTheme';

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const COMPLAINT_CATEGORIES = [
  'Municipal Issue',
  'Service Request',
  'Administrative Request',
  'Infrastructure',
  'Public Safety',
  'Citizen Services',
  'Other',
];

function onlyNumbers(value) {
  return String(value || '').replace(/\D/g, '');
}

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

function toDateInputValue(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.message ||
    err?.data?.message ||
    err?.message ||
    fallback
  );
}

function getLatestDecision(approvals = []) {
  return approvals.find((item) =>
    ['approved', 'rejected'].includes(String(item.action || '').toLowerCase())
  );
}

function formatDecisionAction(action) {
  return String(action || '').toLowerCase() === 'approved'
    ? 'Approved'
    : 'Rejected';
}

function formatDecisionBy(decision) {
  if (!decision?.approver_name) return '—';

  const role = decision.approver_role || 'Staff';
  return `${role} ${decision.approver_name}`;
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

function canEditComplaint(staff, complaint) {
  if (!staff || !complaint) return false;

  const role = staff.role_name;
  const statusId = Number(complaint.status_id);
  const isOwner = Number(staff.staff_id) === Number(complaint.submitted_by);

  if (role === 'Admin') return false;

  if (role === 'Clerk') {
    return isOwner && [1, 5].includes(statusId);
  }

  if (role === 'Director') {
    return statusId !== 7;
  }

  if (role === 'Minister') {
    return true;
  }

  return false;
}

function getEditHint(staff, complaint) {
  if (!staff || !complaint) return '';

  const role = staff.role_name;
  const statusName = complaint.status_name;

  if (role === 'Admin') {
    return 'Admins manage users and lookup tables, but cannot edit complaint details.';
  }

  if (role === 'Clerk') {
    const isOwner = Number(staff.staff_id) === Number(complaint.submitted_by);

    if (!isOwner) {
      return 'Only the clerk who submitted this complaint can edit it.';
    }

    if (![1, 5].includes(Number(complaint.status_id))) {
      return 'Clerks can edit their own complaint only while it is Submitted or Rejected.';
    }

    if (String(statusName).toLowerCase() === 'rejected') {
      return 'This complaint was rejected. You can edit it with new supporting details, then return it to Submitted through the workflow panel.';
    }

    return 'You can edit this complaint because you submitted it and it is still in an editable stage.';
  }

  if (role === 'Director') {
    return 'Directors can edit complaint details except when the complaint is Closed.';
  }

  if (role === 'Minister') {
    return 'Ministers can edit complaint details and override workflow decisions when needed.';
  }

  return '';
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

function ComplaintCitizenEditor({ currentCitizen, onChange }) {
  const [query, setQuery] = useState(currentCitizen?.citizen_name || '');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const [selected, setSelected] = useState(
    currentCitizen?.citizen_id
      ? {
          citizen_id: currentCitizen.citizen_id,
          full_name: currentCitizen.citizen_name,
          national_id: currentCitizen.citizen_national_id,
        }
      : null
  );

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    national_id: '',
    full_name: '',
    phone_1: '',
    email: '',
    address: '',
  });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (currentCitizen?.citizen_id) {
      const citizen = {
        citizen_id: currentCitizen.citizen_id,
        full_name: currentCitizen.citizen_name,
        national_id: currentCitizen.citizen_national_id,
      };

      setSelected(citizen);
      setQuery(currentCitizen.citizen_name || '');
      onChange(currentCitizen.citizen_id);
    } else {
      setSelected(null);
      setQuery('');
      onChange(null);
    }
  }, [currentCitizen?.citizen_id]);

  async function handleSearch() {
    if (!query.trim()) return;

    setSearching(true);
    setResults([]);
    setSearched(false);

    try {
      const res = await apiClient.get(
        `/api/v1/citizens?q=${encodeURIComponent(query.trim())}`
      );
      setResults(res.data);
    } catch {
      setResults([]);
    } finally {
      setSearched(true);
      setSearching(false);
    }
  }

  function handleSelect(citizen) {
    setSelected(citizen);
    setResults([]);
    setQuery(citizen.full_name);
    setSearched(false);
    setShowCreate(false);
    onChange(citizen.citizen_id);
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    setResults([]);
    setSearched(false);
    onChange(null);
  }

  async function handleCreate() {
    setCreateError('');

    if (!createForm.national_id.trim() || !createForm.full_name.trim()) {
      setCreateError('National ID and Full Name are required.');
      return;
    }

    setCreating(true);

    try {
      const res = await apiClient.post('/api/v1/citizens', createForm);
      handleSelect(res.data);

      setCreateForm({
        national_id: '',
        full_name: '',
        phone_1: '',
        email: '',
        address: '',
      });
      setShowCreate(false);
    } catch (err) {
      setCreateError(
        err?.response?.data?.message ||
          err?.message ||
          'Could not create citizen.'
      );
    } finally {
      setCreating(false);
    }
  }

  const inputClass =
    'block w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ministry-600 focus:ring-4 focus:ring-ministry-600/10';

  return (
    <div className="lg:col-span-2">
      <label className="text-sm font-medium text-slate-700">
        Linked Citizen <span className="font-normal text-slate-400">(optional)</span>
      </label>

      {selected ? (
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <span className="flex-1 text-sm text-blue-800">
            {selected.full_name}
            {selected.national_id && (
              <span className="ml-2 text-xs text-blue-500">
                ID: {selected.national_id}
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearched(false);
              }}
              onKeyDown={(e) =>
                e.key === 'Enter' && (e.preventDefault(), handleSearch())
              }
              placeholder="Search by name or national ID…"
              className={inputClass}
            />

            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="btn-secondary"
            >
              {searching ? '…' : 'Search'}
            </button>
          </div>

          {results.length > 0 && (
            <ul className="mt-2 max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              {results.map((citizen) => (
                <li
                  key={citizen.citizen_id}
                  onClick={() => handleSelect(citizen)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
                >
                  <span className="font-medium">{citizen.full_name}</span>
                  {citizen.national_id && (
                    <span className="ml-2 text-xs text-slate-400">
                      ID: {citizen.national_id}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {searched && results.length === 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              No citizen found.
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="font-semibold text-blue-600 hover:underline"
              >
                Create new citizen
              </button>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">
            New Citizen Record
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500">National ID *</label>
              <input
                type="text"
                value={createForm.national_id}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    national_id: e.target.value,
                  }))
                }
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Full Name *</label>
              <input
                type="text"
                value={createForm.full_name}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    full_name: e.target.value,
                  }))
                }
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Phone</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={createForm.phone_1}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    phone_1: onlyNumbers(e.target.value),
                  }))
                }
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Email</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    email: e.target.value,
                  }))
                }
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-slate-500">Address</label>
              <input
                type="text"
                value={createForm.address}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    address: e.target.value,
                  }))
                }
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </div>

          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary"
            >
              {creating ? 'Saving…' : 'Save Citizen'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setCreateError('');
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComplaintEditPanel({
  complaint,
  staff,
  departments,
  complaintTypes,
  onSaved,
}) {
  const { t } = useTranslation();

  const allowed = canEditComplaint(staff, complaint);
  const hint = getEditHint(staff, complaint);

  const [isOpen, setIsOpen] = useState(false);
  const [fields, setFields] = useState({
    title: complaint.title || '',
    description: complaint.description || '',
    category: complaint.category || '',
    priority: complaint.priority || 'Medium',
    department_id: complaint.department_id || '',
    type_id: complaint.type_id || '',
    file_number: complaint.file_number || '',
    citizen_id: complaint.citizen_id || null,
    completion_deadline: toDateInputValue(complaint.completion_deadline),
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFields({
      title: complaint.title || '',
      description: complaint.description || '',
      category: complaint.category || '',
      priority: complaint.priority || 'Medium',
      department_id: complaint.department_id || '',
      type_id: complaint.type_id || '',
      file_number: complaint.file_number || '',
      citizen_id: complaint.citizen_id || null,
      completion_deadline: toDateInputValue(complaint.completion_deadline),
    });
    setError('');
    setSuccess('');
  }, [complaint]);

  function handleChange(e) {
    const { name, value } = e.target;

    setFields((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError('');
    setSuccess('');
  }

  function validate() {
    if (!fields.title.trim()) return 'Title is required.';
    if (!fields.description.trim()) return 'Description is required.';
    if (!fields.category.trim()) return 'Category is required.';
    if (!fields.department_id) return 'Department is required.';
    if (!fields.type_id) return 'Complaint type is required.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError('');
    setSuccess('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      await updateComplaint(complaint.complaint_id, {
        title: fields.title.trim(),
        description: fields.description.trim(),
        category: fields.category.trim(),
        priority: fields.priority,
        department_id: Number(fields.department_id),
        type_id: Number(fields.type_id),
        citizen_id: fields.citizen_id || null,
        completion_deadline: fields.completion_deadline || null,
      });

      setSuccess('Complaint updated successfully.');

      if (onSaved) {
        await onSaved();
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update complaint.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SectionCard
      title="Edit Complaint"
      actions={
        allowed && (
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              setError('');
              setSuccess('');
            }}
            className="btn-secondary py-2 text-xs"
          >
            {isOpen ? 'Hide edit form' : 'Edit complaint'}
          </button>
        )
      }
    >
      <div
        className={`rounded-2xl border px-4 py-3 text-sm ${
          allowed
            ? 'border-blue-100 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-slate-50 text-slate-500'
        }`}
      >
        {hint || 'No editing action is available for your role.'}
      </div>

      {allowed && isOpen && (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={fields.title}
                onChange={handleChange}
                maxLength={200}
                className="input-field mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                File Number
              </label>
              <input
                type="text"
                name="file_number"
                value={fields.file_number}
                readOnly
                className="input-field mt-1 bg-slate-100 text-slate-500"
              />
              <p className="mt-1 text-xs text-slate-400">
                File number is auto-generated and cannot be edited.
              </p>
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={fields.description}
                onChange={handleChange}
                rows={4}
                className="input-field mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={fields.category}
                onChange={handleChange}
                className="input-field mt-1"
              >
                <option value="">Select category</option>
                {COMPLAINT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Priority
              </label>
              <select
                name="priority"
                value={fields.priority}
                onChange={handleChange}
                className="input-field mt-1"
              >
                <option value="Low">{t('complaints.priority.low')}</option>
                <option value="Medium">{t('complaints.priority.medium')}</option>
                <option value="High">{t('complaints.priority.high')}</option>
                <option value="Urgent">{t('complaints.priority.urgent')}</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                name="department_id"
                value={fields.department_id}
                onChange={handleChange}
                className="input-field mt-1"
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.department_name || d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Complaint Type <span className="text-red-500">*</span>
              </label>
              <select
                name="type_id"
                value={fields.type_id}
                onChange={handleChange}
                className="input-field mt-1"
              >
                <option value="">Select type</option>
                {complaintTypes.map((ct) => (
                  <option key={ct.type_id} value={ct.type_id}>
                    {ct.type_name}
                  </option>
                ))}
              </select>
            </div>

            <ComplaintCitizenEditor
              currentCitizen={{
                citizen_id: complaint.citizen_id,
                citizen_name: complaint.citizen_name,
                citizen_national_id: complaint.citizen_national_id,
              }}
              onChange={(citizenId) =>
                setFields((prev) => ({
                  ...prev,
                  citizen_id: citizenId,
                }))
              }
            />

            <div>
              <label className="text-sm font-medium text-slate-700">
                Deadline
              </label>
              <input
                type="date"
                name="completion_deadline"
                value={fields.completion_deadline}
                onChange={handleChange}
                className="input-field mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setError('');
                setSuccess('');
              }}
              className="btn-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

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

function ComplaintJourney({ statuses, currentStatusName }) {
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
              !isCurrent && currentIndex >= 0 && index < currentIndex;
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
  const [departments, setDepartments] = useState([]);
  const [complaintTypes, setComplaintTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [comp, track, attach, sts, deps, types] = await Promise.all([
        getComplaintById(id),
        getComplaintTracking(id),
        getComplaintAttachments(id),
        getStatuses(),
        getDepartments(),
        getComplaintTypes(),
      ]);

      setComplaint(comp);
      setTracking(track);
      setAttachments(attach);
      setStatuses(sts);
      setDepartments(deps);
      setComplaintTypes(types);
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

  const role = staff?.role_name;
  const isOwner = Number(staff?.staff_id) === Number(complaint.submitted_by);
  const canUpload =
    role === 'Minister' ||
    role === 'Director' ||
    (role === 'Clerk' && isOwner);

  const overdue = isOverdueComplaint(complaint);
  const latestDecision = getLatestDecision(complaint.approvals || []);

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

          {latestDecision && (
            <>
              <DetailRow
                label="Decision"
                value={formatDecisionAction(latestDecision.action)}
              />

              <DetailRow
                label="Decision By"
                value={formatDecisionBy(latestDecision)}
              />

              <DetailRow
                label="Decision Date"
                value={formatDateTime(latestDecision.action_at)}
              />
            </>
          )}

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

      <ComplaintEditPanel
        complaint={complaint}
        staff={staff}
        departments={departments}
        complaintTypes={complaintTypes}
        onSaved={loadAll}
      />

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