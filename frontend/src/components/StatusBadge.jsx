/**
 * StatusBadge.jsx
 * Reusable status pill used in the complaints table and detail header.
 *
 * Updated:
 * - Prevents "Under Review" and "Pending Approval" from wrapping badly
 * - Keeps dot aligned and circular
 * - Keeps priority badges on one clean line
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
    <span
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold leading-none ${theme.badge}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${theme.dot}`} />
      <span className="whitespace-nowrap leading-none">
        {statusName ?? '—'}
      </span>
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const colorClass =
    PRIORITY_COLORS[String(priority || '').toLowerCase()] ??
    'border border-slate-200 bg-slate-100 text-slate-700';

  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold leading-none ${colorClass}`}
    >
      {priority ?? '—'}
    </span>
  );
}