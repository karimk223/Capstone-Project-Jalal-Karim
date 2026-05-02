/**
 * src/pages/NewComplaintForm.jsx
 * Implements FR-5 (create complaint), FR-6 (auto status=Submitted + TRACKING),
 * FR-7 (file attachment), FR-8 (is_scanned flip), FR-9 (citizen linking).
 *
 * Updated:
 * - file_number is auto-generated
 * - file_number is shown as read-only
 * - file_number is always sent to backend
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createComplaint, uploadAttachment } from '../api/complaints';
import { getDepartments, getComplaintTypes } from '../api/lookups';
import apiClient from '../api/client';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

const COMPLAINT_CATEGORIES = [
  'Municipal Issue',
  'Service Request',
  'Administrative Request',
  'Infrastructure',
  'Public Safety',
  'Citizen Services',
  'Other',
];

function generateFileNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const stamp = String(Date.now()).slice(-8);
  const random = Math.floor(Math.random() * 900 + 100);

  return `MIN-${year}-${stamp}${random}`;
}

function Field({ label, error, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function CitizenSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
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

  async function handleSearch() {
    if (!query.trim()) return;

    setSearching(true);
    setResults([]);
    setSearched(false);
    setSelected(null);
    onSelect(null);

    try {
      const res = await apiClient.get(`/api/v1/citizens?q=${encodeURIComponent(query.trim())}`);
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
    onSelect(citizen.citizen_id);
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    setResults([]);
    setSearched(false);
    onSelect(null);
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
      setShowCreate(false);
      setCreateForm({
        national_id: '',
        full_name: '',
        phone_1: '',
        email: '',
        address: '',
      });
    } catch (err) {
      const code = err.code;
      setCreateError(
        code === 'DUPLICATE_NATIONAL_ID'
          ? 'A citizen with this national ID already exists.'
          : err.message || 'Could not create citizen.'
      );
    } finally {
      setCreating(false);
    }
  }

  const inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Link Citizen <span className="font-normal text-gray-400">(optional)</span>
      </label>

      {selected ? (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-2">
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
            className="text-xs text-red-500 hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
              placeholder="Search by name or national ID…"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {searching ? '…' : 'Search'}
            </button>
          </div>

          {results.length > 0 && (
            <ul className="max-h-40 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
              {results.map((c) => (
                <li
                  key={c.citizen_id}
                  onClick={() => handleSelect(c)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
                >
                  <span className="font-medium">{c.full_name}</span>
                  {c.national_id && (
                    <span className="ml-2 text-xs text-gray-400">
                      ID: {c.national_id}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {searched && results.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              No citizen found.
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="text-blue-600 hover:underline"
              >
                Create new citizen
              </button>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <div className="mt-2 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-700">New Citizen Record</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-gray-500">National ID *</label>
              <input
                type="text"
                value={createForm.national_id}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, national_id: e.target.value }))
                }
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Full Name *</label>
              <input
                type="text"
                value={createForm.full_name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, full_name: e.target.value }))
                }
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Phone</label>
              <input
                type="text"
                value={createForm.phone_1}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, phone_1: e.target.value }))
                }
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Email</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, email: e.target.value }))
                }
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500">Address</label>
              <input
                type="text"
                value={createForm.address}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, address: e.target.value }))
                }
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </div>

          {createError && <p className="text-sm text-red-600">{createError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="rounded-md bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {creating ? 'Saving…' : 'Save Citizen'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setCreateError('');
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewComplaintForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [complaintTypes, setComplaintTypes] = useState([]);

  useEffect(() => {
    getDepartments().then(setDepartments).catch(() => {});
    getComplaintTypes().then(setComplaintTypes).catch(() => {});
  }, []);

  const [fields, setFields] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'Medium',
    department_id: '',
    type_id: '',
    file_number: generateFileNumber(),
    completion_deadline: '',
  });

  const [citizenId, setCitizenId] = useState(null);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;

    setFields((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  function handleFileChange(e) {
    const selected = e.target.files[0];

    setFileError('');

    if (!selected) {
      setFile(null);
      return;
    }

    if (!ALLOWED_MIME.includes(selected.type)) {
      setFileError(t('complaints.form.errors.fileType'));
      setFile(null);
      return;
    }

    if (selected.size > MAX_FILE_BYTES) {
      setFileError(t('complaints.form.errors.fileSize'));
      setFile(null);
      return;
    }

    setFile(selected);
  }

  function validate() {
    const errs = {};

    if (!fields.title.trim()) {
      errs.title = t('complaints.form.errors.titleRequired');
    } else if (fields.title.length > 200) {
      errs.title = t('complaints.form.errors.titleMax');
    }

    if (!fields.description.trim()) {
      errs.description = t('complaints.form.errors.descRequired');
    }

    if (!fields.category) {
      errs.category = 'Category is required.';
    }

    if (!fields.priority) {
      errs.priority = t('complaints.form.errors.priorityRequired');
    }

    if (!fields.department_id) {
      errs.department_id = 'Department is required.';
    }

    if (!fields.type_id) {
      errs.type_id = 'Complaint type is required.';
    }

    if (!fields.file_number.trim()) {
      errs.file_number = 'File number is required.';
    }

    return errs;
  }

  function resetFileNumber() {
    setFields((prev) => ({
      ...prev,
      file_number: generateFileNumber(),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setSubmitError('');

    const errs = validate();
    setErrors(errs);

    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);

    try {
      const payload = {
        title: fields.title.trim(),
        description: fields.description.trim(),
        category: fields.category,
        priority: fields.priority,
        department_id: Number(fields.department_id),
        type_id: Number(fields.type_id),
        file_number: fields.file_number.trim(),
        ...(fields.completion_deadline && {
          completion_deadline: fields.completion_deadline,
        }),
        ...(citizenId && {
          citizen_id: citizenId,
        }),
      };

      const created = await createComplaint(payload);

      if (file) {
        try {
          await uploadAttachment(created.complaint_id, file);
        } catch {
          // Non-fatal. Complaint was created, only attachment failed.
        }
      }

      navigate(`/complaints/${created.complaint_id}`);
    } catch (err) {
      if (err.code === 'DUPLICATE_FILE_NUMBER') {
        setSubmitError('This generated file number already exists. Click "Generate new number" and try again.');
        return;
      }

      setSubmitError(err.message || t('complaints.form.errors.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm ' +
    'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-blue-600 hover:underline"
        >
          ← {t('common.back')}
        </button>

        <h1 className="mt-2 text-2xl font-semibold text-gray-900">
          {t('complaints.form.title')}
        </h1>
      </div>

      {submitError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <Field label={t('complaints.form.labelTitle')} error={errors.title} required>
          <input
            type="text"
            name="title"
            value={fields.title}
            onChange={handleChange}
            maxLength={200}
            placeholder={t('complaints.form.placeholderTitle')}
            className={inputClass}
          />
        </Field>

        <Field
          label={t('complaints.form.labelDescription')}
          error={errors.description}
          required
        >
          <textarea
            name="description"
            value={fields.description}
            onChange={handleChange}
            rows={4}
            placeholder={t('complaints.form.placeholderDescription')}
            className={inputClass}
          />
        </Field>

        <Field label={t('complaints.form.labelCategory')} error={errors.category} required>
          <select
            name="category"
            value={fields.category}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">Select category</option>
            {COMPLAINT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('complaints.form.labelPriority')} error={errors.priority} required>
          <select
            name="priority"
            value={fields.priority}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="Low">{t('complaints.priority.low')}</option>
            <option value="Medium">{t('complaints.priority.medium')}</option>
            <option value="High">{t('complaints.priority.high')}</option>
            <option value="Urgent">{t('complaints.priority.urgent')}</option>
          </select>
        </Field>

        <Field
          label={t('complaints.form.labelDepartment')}
          error={errors.department_id}
          required
        >
          <select
            name="department_id"
            value={fields.department_id}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">{t('complaints.form.selectDepartment')}</option>
            {departments.map((d) => (
              <option key={d.department_id} value={d.department_id}>
                {d.department_name || d.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('complaints.form.labelType')} error={errors.type_id} required>
          <select
            name="type_id"
            value={fields.type_id}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">{t('complaints.form.selectType')}</option>
            {complaintTypes.map((ct) => (
              <option key={ct.type_id} value={ct.type_id}>
                {ct.type_name}
              </option>
            ))}
          </select>
        </Field>

        <CitizenSearch onSelect={setCitizenId} />

        <Field label={t('complaints.form.labelFileNumber')} error={errors.file_number} required>
          <div className="flex gap-2">
            <input
              type="text"
              name="file_number"
              value={fields.file_number}
              readOnly
              maxLength={50}
              className={`${inputClass} bg-gray-100 text-gray-600`}
            />

            <button
              type="button"
              onClick={resetFileNumber}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Generate new
            </button>
          </div>

          <p className="mt-1 text-xs text-gray-400">
            Auto-generated unique file number.
          </p>
        </Field>

        <Field
          label={t('complaints.form.labelDeadline')}
          error={errors.completion_deadline}
        >
          <input
            type="date"
            name="completion_deadline"
            value={fields.completion_deadline}
            onChange={handleChange}
            className={inputClass}
          />
        </Field>

        <Field label={t('complaints.form.labelAttachment')} error={fileError}>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50"
          />

          <p className="mt-1 text-xs text-gray-400">
            {t('complaints.form.attachmentHint')}
          </p>
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? t('complaints.form.submitting')
              : t('complaints.form.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}