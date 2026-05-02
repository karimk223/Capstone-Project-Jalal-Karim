// src/pages/Profile.jsx
// "My Profile" page — view own staff record, change own password.
//
// Implements FR-1 (self-service password change).
// Addresses Gap 7 (raw error codes) by mapping every server error to a
// translated, friendly message via the apiError utility.
//
// Data sources:
//   GET  /api/v1/auth/me              → personal info (no password_hash)
//   POST /api/v1/auth/change-password → updates STAFF.password_hash via bcrypt

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import { getMe, changePassword } from '../api/auth';
import { getErrorMessage } from '../utils/apiError';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 100;

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function Profile() {
  const { t } = useTranslation();

  // ── Profile loading ────────────────────────────────────────────────────────
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // ── Password form ──────────────────────────────────────────────────────────
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await getMe();
        if (active) { setProfile(data.staff); setLoadError(null); }
      } catch (err) {
        if (active) setLoadError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  function validate() {
    const errs = {};
    if (!oldPassword) errs.oldPassword = t('validation.required');
    if (!newPassword) {
      errs.newPassword = t('validation.required');
    } else if (newPassword.length < PASSWORD_MIN) {
      errs.newPassword = t('validation.passwordMin');
    } else if (newPassword.length > PASSWORD_MAX) {
      errs.newPassword = t('validation.passwordMax');
    } else if (newPassword === oldPassword) {
      errs.newPassword = t('validation.samePassword');
    }
    if (newPassword !== confirmPassword) {
      errs.confirmPassword = t('validation.passwordMismatch');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      await changePassword({ oldPassword, newPassword });
      toast.success(t('profile.passwordChanged'));
      // Clear plaintext passwords from state immediately after success
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      setFieldErrors({});
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return <p className="p-6 text-gray-500">{t('common.loading')}</p>;
  }

  if (loadError) {
    return (
      <div className="p-6">
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {t('profile.loadFailed')}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t('profile.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('profile.subtitle')}</p>
      </header>

      {/* ── Personal info (read-only) ────────────────────────────────────── */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <Field label={t('profile.fullName')} value={profile.full_name} />
          <Field label={t('profile.email')} value={profile.email} />
          <Field label={t('profile.role')} value={profile.role_name} />
          <Field label={t('profile.memberSince')} value={formatDate(profile.created_at)} />
          <Field
            label={t('profile.status')}
            value={profile.is_active ? t('profile.active') : t('profile.disabled')}
            valueClass={profile.is_active ? 'font-medium text-green-700' : 'font-medium text-red-700'}
          />
        </dl>
      </section>

      {/* ── Change password ──────────────────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t('profile.changePassword')}
        </h2>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <PasswordField
            id="oldPassword" label={t('profile.currentPassword')}
            value={oldPassword} onChange={setOldPassword}
            error={fieldErrors.oldPassword} autoComplete="current-password"
          />
          <PasswordField
            id="newPassword" label={t('profile.newPassword')}
            value={newPassword} onChange={setNewPassword}
            error={fieldErrors.newPassword} autoComplete="new-password"
          />
          <PasswordField
            id="confirmNewPassword" label={t('profile.confirmNewPassword')}
            value={confirmPassword} onChange={setConfirmPassword}
            error={fieldErrors.confirmPassword} autoComplete="new-password"
          />
          <button
            type="submit" disabled={submitting}
            className="rounded bg-ministry-700 px-5 py-2 text-sm font-medium text-white hover:bg-ministry-800 focus:outline-none focus:ring-2 focus:ring-ministry-700 disabled:opacity-50"
          >
            {submitting ? t('profile.saving') : t('profile.savePassword')}
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({ label, value, valueClass = '' }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className={`mt-1 text-gray-900 ${valueClass}`}>{value || '—'}</dd>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, error, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        id={id} name={id} type="password"
        value={value} onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={[
          'mt-1 block w-full rounded border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2',
          error ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-ministry-700',
        ].join(' ')}
      />
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
