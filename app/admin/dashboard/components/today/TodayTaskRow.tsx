/** ADMIN layer — one line of the worklist: a count, and what it is made of.
 *
 * The row is a disclosure rather than a link because the count and the items
 * behind it are the same thing at two zoom levels. Collapsed it answers "how
 * much of this is there"; expanded it answers "which ones", without leaving
 * the page you were reading the counts on.
 *
 * A row with no worklist task cannot be expanded — that is the ambient facts,
 * where there is nothing to work — so it renders as a plain link instead.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlertItem, AlertTone } from '@/app/admin/lib/alert-item';
import { TodayEntryList } from './TodayEntryList';

/** Tone drives the count badge only. The row itself stays neutral: a list
 *  where every line is tinted is a list with no emphasis left to give. */
const badgeTones: Record<AlertTone, string> = {
  destructive: 'bg-destructive-background text-destructive border-destructive-border',
  warning: 'bg-warning-background text-warning border-warning-border',
  info: 'bg-info-background text-info border-info-border',
  accent: 'bg-accent/10 text-accent border-accent/30',
};

interface TodayTaskRowProps {
  alert: AlertItem;
  onChanged: () => void;
}

export function TodayTaskRow({ alert, onChanged }: TodayTaskRowProps) {
  const [open, setOpen] = useState(false);

  // The ticker's copy carries an emoji and shouted words that read as urgency
  // in four seconds of rotation and as noise in a list you scan. The count is
  // a badge here, so the sentence does not need to repeat it either.
  const label = alert.message.replace(/^[^\p{L}\p{N}]+/u, '').replace(/^\d+\s*/, '');

  if (!alert.task) {
    return (
      <li>
        <Link
          href={alert.link}
          className="flex min-h-11 items-center gap-3 px-3 py-2 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        >
          <span className="flex-1 text-body-sm text-text-secondary">{label}</span>
          <ExternalLink className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      >
        <span
          className={cn(
            'grid min-w-8 shrink-0 place-items-center rounded-full border px-2 py-0.5 text-body-sm font-bold tabular-nums',
            badgeTones[alert.tone],
          )}
        >
          {alert.count ?? 1}
        </span>

        <span className="flex-1 text-body-sm font-medium text-text-primary">{label}</span>

        <ChevronDown
          className={cn('size-4 shrink-0 text-text-secondary transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {/* Mounted only while open, so nine collapsed rows do not each hold a
          fetch and a list nobody has asked to see. */}
      {open && (
        <div className="border-t border-divider bg-background-secondary">
          <TodayEntryList task={alert.task} href={alert.link} onChanged={onChanged} />
        </div>
      )}
    </li>
  );
}
