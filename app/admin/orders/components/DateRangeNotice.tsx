/** ADMIN layer — "you are looking at a slice of the orders, not all of them".
 *
 * The dashboard's cards link here with a date window attached, so a card
 * reading "42 orders" opens exactly those 42. Without this bar the operator
 * would see a filtered list that looks like the whole list — and a count that
 * silently excludes rows is how somebody concludes orders have stopped coming
 * in.
 *
 * So: say the window, and give one click back to everything.
 */
'use client';

import { CalendarRange, X } from 'lucide-react';

interface DateRangeNoticeProps {
  /** ISO, inclusive. Empty when nothing linked here. */
  from?: string;
  /** ISO, exclusive. */
  to?: string;
  onClear: () => void;
}

function label(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The window is exclusive at the top, so the last day it actually includes is
 *  the day before `to`. Showing `to` itself would name a date whose orders are
 *  not in the list. */
function lastIncludedDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return label(new Date(at.getTime() - 24 * 60 * 60 * 1000).toISOString());
}

export default function DateRangeNotice({ from, to, onClear }: DateRangeNoticeProps) {
  // The "is a window even set?" test lives here rather than at the call site,
  // so the orders page renders one element instead of carrying a guard for a
  // banner it does not own.
  if (!from || !to) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-2 rounded-control border border-info-border bg-info-background px-3 py-2 text-body-sm text-info"
    >
      <CalendarRange size={16} aria-hidden className="shrink-0" />
      <span>
        Showing orders from <strong>{label(from)}</strong> to{' '}
        <strong>{lastIncludedDay(to)}</strong>.
      </span>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 rounded-control px-2 py-1 font-medium underline-offset-2 transition-colors hover:bg-info/10 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus"
      >
        <X size={14} aria-hidden />
        Show all orders
      </button>
    </div>
  );
}
