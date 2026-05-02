/**
 * Sidebar navigation with role-based visibility.
 */

import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  ClipboardList,
  BadgeCheck,
  BarChart3,
  Users,
  UserPlus,
  Settings,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import MinistryLogo from './MinistryLogo';

const ICONS = {
  '/dashboard': LayoutDashboard,
  '/complaints': ClipboardList,
  '/approvals': BadgeCheck,
  '/reports': BarChart3,
  '/users': Users,
  '/admin/register': UserPlus,
  '/admin/lookups': Settings,
};

function linkClass({ isActive }) {
  const base =
    'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200';

  return isActive
    ? `${base} bg-white text-ministry-900 shadow-lg shadow-blue-950/10 ring-1 ring-white/70`
    : `${base} text-blue-50/82 hover:bg-white/10 hover:text-white`;
}

const NAV_LINKS = [
  { to: '/dashboard', labelKey: 'nav.dashboard', roles: null },
  { to: '/complaints', labelKey: 'nav.complaints', roles: null },
  { to: '/approvals', labelKey: 'nav.approvals', roles: ['Director', 'Minister', 'Admin'] },
  { to: '/reports', labelKey: 'nav.reports', roles: null },
];

const ADMIN_LINKS = [
  { to: '/users', labelKey: 'nav.users', roles: ['Admin'] },
  { to: '/admin/register', labelKey: 'nav.register', roles: ['Admin'] },
  { to: '/admin/lookups', labelKey: 'nav.lookups', roles: ['Admin'] },
];

export default function Sidebar() {
  const { t } = useTranslation();
  const { staff } = useAuth();

  if (!staff) return null;

  const roleName = staff.role_name;
  const visibleNav = NAV_LINKS.filter((l) => l.roles === null || l.roles.includes(roleName));
  const visibleAdmin = ADMIN_LINKS.filter((l) => l.roles.includes(roleName));

  function renderLink(link) {
    const Icon = ICONS[link.to];

    return (
      <NavLink key={link.to} to={link.to} className={linkClass}>
        {({ isActive }) => (
          <>
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-2xl text-sm shadow-inner transition ${
                isActive
                  ? 'bg-ministry-50 text-ministry-800 shadow-blue-950/5'
                  : 'bg-white/10 text-blue-50 shadow-white/5 group-hover:bg-white/15 group-hover:text-white'
              }`}
            >
              {Icon && <Icon size={18} strokeWidth={2.15} />}
            </span>

            <span>{t(link.labelKey)}</span>
          </>
        )}
      </NavLink>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 overflow-hidden bg-gradient-to-b from-slate-950 via-ministry-900 to-blue-950 text-white md:flex">
      <div className="relative flex h-full min-h-0 w-full flex-col p-5">
        <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 right-0 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />

        {/* Top logo card */}
        <div className="relative mb-5 shrink-0 rounded-[1.75rem] border border-white/10 bg-white/10 p-4 shadow-2xl shadow-blue-950/20 backdrop-blur-md">
          <MinistryLogo className="text-white" />

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-blue-100/60">Role</p>
              <p className="mt-1 text-sm font-semibold">{staff.role_name}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-blue-100/60">Workspace</p>
              <p className="mt-1 text-sm font-semibold">Complaints</p>
            </div>
          </div>
        </div>

        {/* Middle menu scrolls if screen is small */}
        <nav className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
          <div className="flex flex-col gap-2">
            {visibleNav.map(renderLink)}

            {visibleAdmin.length > 0 && (
              <>
                <p className="mb-1 mt-5 px-3 text-[11px] font-bold uppercase tracking-[0.24em] text-blue-100/50">
                  {t('nav.admin')}
                </p>
                {visibleAdmin.map(renderLink)}
              </>
            )}
          </div>
        </nav>

        {/* Bottom user card always visible */}
        <div className="relative mt-4 shrink-0 rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur-md">
          <p className="truncate text-sm font-semibold text-white">{staff.full_name}</p>
          <p className="mt-1 text-xs text-blue-100/70">Signed in to the ministry portal</p>
          <p className="mt-3 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-xs text-blue-50/85">
            {staff.role_name}
          </p>
        </div>
      </div>
    </aside>
  );
}