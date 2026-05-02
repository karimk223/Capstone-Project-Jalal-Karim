/**
 * Topbar.
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAuth from '../hooks/useAuth';
import MinistryLogo from './MinistryLogo';

export default function Topbar() {
  const { t } = useTranslation();
  const { staff, logout } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/70 bg-white/75 px-4 py-3 shadow-sm shadow-slate-200/60 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="md:hidden">
            <MinistryLogo compact className="text-slate-900" />
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-ministry-700">Ministry of Interior • Lebanon</p>
            <p className="mt-1 truncate text-sm text-slate-500">Smart correspondence and complaints workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-900">{staff?.full_name}</p>
            <p className="text-xs text-slate-500">{staff?.role_name}</p>
          </div>
          <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-ministry-50 text-sm font-bold text-ministry-800 ring-1 ring-blue-100 sm:flex">
            {staff?.full_name?.split(' ').map((p) => p[0]).join('').slice(0, 2) || 'U'}
          </div>
          <button type="button" onClick={() => navigate('/profile')} className="btn-secondary py-2">
            {t('nav.profile')}
          </button>
          <button type="button" onClick={handleSignOut} className="btn-primary py-2">
            {t('app.signOut')}
          </button>
        </div>
      </div>
    </header>
  );
}
