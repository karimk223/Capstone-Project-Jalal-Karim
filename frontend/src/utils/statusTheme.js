const THEMES = {
  submitted: {
    badge: 'border border-blue-200 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    soft: 'from-blue-50 to-white',
    accent: 'text-blue-700',
    ring: 'ring-blue-100',
    line: 'border-blue-200',
    step: 'bg-blue-500 text-white',
    faint: 'bg-blue-100/70 text-blue-700',
  },
  'under review': {
    badge: 'border border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    soft: 'from-amber-50 to-white',
    accent: 'text-amber-700',
    ring: 'ring-amber-100',
    line: 'border-amber-200',
    step: 'bg-amber-500 text-white',
    faint: 'bg-amber-100/70 text-amber-700',
  },
  'pending approval': {
    badge: 'border border-violet-200 bg-violet-50 text-violet-700',
    dot: 'bg-violet-500',
    soft: 'from-violet-50 to-white',
    accent: 'text-violet-700',
    ring: 'ring-violet-100',
    line: 'border-violet-200',
    step: 'bg-violet-500 text-white',
    faint: 'bg-violet-100/70 text-violet-700',
  },
  approved: {
    badge: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    soft: 'from-emerald-50 to-white',
    accent: 'text-emerald-700',
    ring: 'ring-emerald-100',
    line: 'border-emerald-200',
    step: 'bg-emerald-500 text-white',
    faint: 'bg-emerald-100/70 text-emerald-700',
  },
  rejected: {
    badge: 'border border-rose-200 bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
    soft: 'from-rose-50 to-white',
    accent: 'text-rose-700',
    ring: 'ring-rose-100',
    line: 'border-rose-200',
    step: 'bg-rose-500 text-white',
    faint: 'bg-rose-100/70 text-rose-700',
  },
  resolved: {
    badge: 'border border-teal-200 bg-teal-50 text-teal-700',
    dot: 'bg-teal-500',
    soft: 'from-teal-50 to-white',
    accent: 'text-teal-700',
    ring: 'ring-teal-100',
    line: 'border-teal-200',
    step: 'bg-teal-500 text-white',
    faint: 'bg-teal-100/70 text-teal-700',
  },
  closed: {
    badge: 'border border-slate-200 bg-slate-100 text-slate-700',
    dot: 'bg-slate-500',
    soft: 'from-slate-50 to-white',
    accent: 'text-slate-700',
    ring: 'ring-slate-100',
    line: 'border-slate-200',
    step: 'bg-slate-500 text-white',
    faint: 'bg-slate-200/80 text-slate-700',
  },
  default: {
    badge: 'border border-ministry-200 bg-ministry-50 text-ministry-700',
    dot: 'bg-ministry-700',
    soft: 'from-ministry-50 to-white',
    accent: 'text-ministry-700',
    ring: 'ring-blue-100',
    line: 'border-blue-100',
    step: 'bg-ministry-700 text-white',
    faint: 'bg-ministry-50 text-ministry-700',
  },
};

export function getStatusTheme(statusName) {
  const key = String(statusName || '').trim().toLowerCase();
  return THEMES[key] || THEMES.default;
}

export const TERMINAL_STATUSES = ['approved', 'rejected', 'resolved', 'closed'];
