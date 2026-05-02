/**
 * Login page.
 * Implements FR-1 (login with bcrypt-verified credentials) and FR-2 (JWT
 * issuance) from the client side. Hits POST /api/v1/auth/login per
 * api-spec.md §1.
 *
 * Addresses Gap 5 (real RBAC, not menu-hiding) — the role_name returned in
 * the response is what the rest of the app uses for client-side gating, but
 * the server still enforces it on every API call.
 *
 * Addresses Gap 7 (raw error codes leak to users) — the api-spec.md §9 error
 * codes are translated here into user-friendly English via i18n. No raw
 * "INVALID_CREDENTIALS" string ever reaches the user.
 */

import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAuth from '../hooks/useAuth';
import MinistryLogo from '../components/MinistryLogo';

const ERROR_CODE_TO_I18N_KEY = {
  INVALID_CREDENTIALS: 'login.errors.invalidCredentials',
  FORBIDDEN_ROLE: 'login.errors.accountDisabled',
  NETWORK_ERROR: 'login.errors.network',
};

export default function Login() {
  const { t } = useTranslation();
  const { login, isAuthenticated, isBooting } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isBooting && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const redirectTo = location.state?.from?.pathname || '/dashboard';

  function validate() {
    const errs = {};
    if (!email.trim()) {
      errs.email = t('login.errors.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = t('login.errors.emailInvalid');
    }
    if (!password) {
      errs.password = t('login.errors.passwordRequired');
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);

    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const i18nKey = ERROR_CODE_TO_I18N_KEY[err.code] || 'login.errors.unknown';
      setSubmitError(t(i18nKey));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.35),transparent_32rem),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_28rem)]" />
      <div className="absolute inset-x-10 top-10 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl shadow-blue-950/40 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden bg-gradient-to-br from-ministry-900 via-ministry-800 to-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <MinistryLogo className="text-white" />
            <h1 className="mt-8 max-w-lg text-4xl font-black leading-tight tracking-tight">A cleaner, calmer, and more professional workspace for managing ministry complaints.</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-blue-50/75">Track every complaint, follow approvals, monitor deadlines, and keep a clear activity trail across departments and staff roles.</p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
              <p className="text-lg font-black">RBAC</p>
              <p className="text-[11px] text-blue-50/70">Secure roles</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
              <p className="text-lg font-black">Workflow</p>
              <p className="text-[11px] text-blue-50/70">Status tracking</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
              <p className="text-lg font-black">Audit</p>
              <p className="text-[11px] text-blue-50/70">Transparent trail</p>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10 lg:p-12">
          <div className="mb-8">
            <div className="lg:hidden">
              <MinistryLogo compact className="text-slate-900" />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-ministry-700">{t('app.ministry')}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{t('login.title')}</h1>
            <p className="mt-2 max-w-md text-sm text-slate-500">{t('login.subtitle')}</p>
          </div>

          {submitError && (
            <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">{t('login.email')}</label>
              <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.emailPlaceholder')} aria-invalid={!!fieldErrors.email} className="input-field mt-2" />
              {fieldErrors.email && <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">{t('login.password')}</label>
              <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('login.passwordPlaceholder')} aria-invalid={!!fieldErrors.password} className="input-field mt-2" />
              {fieldErrors.password && <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.password}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
              {isSubmitting ? t('login.submitting') : t('login.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
