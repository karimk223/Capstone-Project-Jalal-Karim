/**
 * StatusBadge.jsx
 * Reusable status pill used in the complaints table and detail header.
 */

import { getStatusTheme } from '../utils/statusTheme';

const PRIORITY_COLORS = {
  high: 'border border-red-200 bg-red-50 text-red-700',
  medium: 'border border-amber-200 bg-amber-50 text-amber-700',
  low: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  urgent: 'border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
};

export function StatusBadge({ statusName }) {
  const theme = getStatusTheme(statusName);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${theme.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
      {statusName ?? '—'}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const colorClass = PRIORITY_COLORS[String(priority || '').toLowerCase()] ?? 'border border-slate-200 bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${colorClass}`}>
      {priority ?? '—'}
    </span>
  );
}
