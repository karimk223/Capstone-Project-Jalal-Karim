// src/pages/admin/Register.jsx
// Admin-only "Register Staff Account" page.
//
// Per api-spec.md §6, staff accounts are created by Admins only via
// POST /api/v1/admin/staff — there is no public self-registration.
// This route is gated by <ProtectedRoute allowedRoles={['Admin']}> in App.jsx.
//
// Implements FR-1 (account creation with bcrypt-hashed password on the server).
// Addresses Gap 5 (real RBAC) and Gap 7 (no raw error codes shown to user).

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import useAuth from '../../hooks/useAuth';
import { createStaff } from '../../api/admin';
import { getRoles } from '../../api/lookups';
import { getErrorMessage } from '../../utils/apiError';

// Column constraints from schema.sql — client validation mirrors Joi server rules (NFR-2)
const FULL_NAME_MAX = 100;   // STAFF.full_name VARCHAR(100)
const EMAIL_MAX     = 100;   // STAFF.email VARCHAR(100)
const PASSWORD_MIN  = 8;
const PASSWORD_MAX  = 100;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { t } = useTranslation();
  const { staff: currentUser } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [fullName,        setFullName]        = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleId,          setRoleId]          = useState('');
  const [fieldErrors,     setFieldErrors]     = useState({});
  const [submitting,      setSubmitting]      = useState(false);

  // ── Roles dropdown ─────────────────────────────────────────────────────────
  const [roles,        setRoles]        = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // Defense-in-depth: ProtectedRoute already blocks non-Admins, but we also
  // check here so a ProtectedRoute bug doesn't silently expose the form.
  if (currentUser && currentUser.role_name !== 'Admin') {
    return (
      <div className="p-6">
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {t('register.adminOnly')}
        </p>
      </div>
    );
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        // getRoles() comes from Karim's lookups.js — uses GET /api/v1/lookups/roles
        const data = await getRoles();
        if (active) setRoles(data);
      } catch (err) {
        if (active) toast.error(getErrorMessage(err));
      } finally {
        if (active) setRolesLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  function validate() {
    const errs = {};
    if (!fullName.trim()) {
      errs.fullName = t('validation.required');
    } else if (fullName.length > FULL_NAME_MAX) {
      errs.fullName = t('validation.fullNameMax');
    }
    if (!email.trim()) {
      errs.email = t('validation.required');
    } else if (!EMAIL_PATTERN.test(email)) {
      errs.email = t('validation.emailInvalid');
    }
    if (!password) {
      errs.password = t('validation.required');
    } else if (password.length < PASSWORD_MIN) {
      errs.password = t('validation.passwordMin');
    } else if (password.length > PASSWORD_MAX) {
      errs.password = t('validation.passwordMax');
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = t('validation.passwordMismatch');
    }
    if (!roleId) {
      errs.roleId = t('validation.required');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      // Use Karim's createStaff(payload) with snake_case keys — matches his admin.js API
      await createStaff({
        full_name: fullName.trim(),
        email:     email.trim(),
        password,
        role_id:   Number(roleId),
      });
      toast.success(t('register.success'));
      // Reset so Admin can immediately create another account
      setFullName(''); setEmail(''); setPassword('');
      setConfirmPassword(''); setRoleId(''); setFieldErrors({});
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t('register.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('register.subtitle')}</p>
      </header>

      <form
        onSubmit={handleSubmit} noValidate
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <TextField id="fullName" label={t('register.fullName')}
          value={fullName} onChange={setFullName}
          error={fieldErrors.fullName} maxLength={FULL_NAME_MAX} autoComplete="name"
        />
        <TextField id="email" label={t('register.email')} type="email"
          value={email} onChange={setEmail}
          error={fieldErrors.email} maxLength={EMAIL_MAX} autoComplete="email"
        />
        <TextField id="password" label={t('register.password')} type="password"
          value={password} onChange={setPassword}
          error={fieldErrors.password} autoComplete="new-password"
        />
        <TextField id="confirmPassword" label={t('register.confirmPassword')} type="password"
          value={confirmPassword} onChange={setConfirmPassword}
          error={fieldErrors.confirmPassword} autoComplete="new-password"
        />

        {/* Role dropdown — populated from DB via getRoles() so IDs are never hard-coded */}
        <div>
          <label htmlFor="roleId" className="block text-sm font-medium text-gray-700">
            {t('register.role')}
          </label>
          <select
            id="roleId" name="roleId" value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            disabled={rolesLoading}
            aria-invalid={Boolean(fieldErrors.roleId)}
            aria-describedby={fieldErrors.roleId ? 'roleId-error' : undefined}
            className={[
              'mt-1 block w-full rounded border bg-white px-3 py-2 text-sm shadow-sm',
              'focus:outline-none focus:ring-2',
              fieldErrors.roleId
                ? 'border-red-400 focus:ring-red-500'
                : 'border-gray-300 focus:ring-ministry-700',
              rolesLoading ? 'cursor-wait opacity-60' : '',
            ].join(' ')}
          >
            <option value="">
              {rolesLoading ? t('common.loading') : t('register.rolePlaceholder')}
            </option>
            {roles.map((r) => (
              <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
            ))}
          </select>
          {fieldErrors.roleId && (
            <p id="roleId-error" className="mt-1 text-xs text-red-600">{fieldErrors.roleId}</p>
          )}
        </div>

        <button
          type="submit" disabled={submitting || rolesLoading}
          className="rounded bg-ministry-700 px-5 py-2 text-sm font-medium text-white hover:bg-ministry-800 focus:outline-none focus:ring-2 focus:ring-ministry-700 disabled:opacity-50"
        >
          {submitting ? t('register.submitting') : t('register.submit')}
        </button>
      </form>
    </div>
  );
}

function TextField({ id, label, value, onChange, error, type = 'text', maxLength, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        id={id} name={id} type={type}
        value={value} onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength} autoComplete={autoComplete}
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
