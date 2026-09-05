/** ADMIN layer — the sticky bar that appears once rows are selected.
 *
 * Three states, in one place so products, orders and stock behave identically:
 *   idle      — "N selected", the caller's action controls, and Clear.
 *   pending   — the undo window counting down, with nothing yet written.
 *   running   — the request is out; controls are locked.
 *
 * Sticky to the bottom of the viewport rather than the top of the table: the
 * rows being acted on stay visible, and on a phone the bar sits where a thumb
 * already is.
 */
'use client';

import { X, Undo2 } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import type { PendingBulkAction } from '../hooks/useBulkAction';

interface BulkActionBarProps {
  count: number;
  pending: PendingBulkAction | null;
  running: boolean;
  onUndo: () => void;
  onApplyNow: () => void;
  onClear: () => void;
  /** The action controls for this table. Hidden while an action is in flight. */
  children: React.ReactNode;
}

export default function BulkActionBar({
  count,
  pending,
  running,
  onUndo,
  onApplyNow,
  onClear,
  children,
}: BulkActionBarProps) {
  if (count === 0 && !pending && !running) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 mt-4 border-t border-border bg-surface/95 backdrop-blur px-4 md:px-6 lg:px-8 py-3 shadow-elevation-2"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {pending ? (
          <>
            <p className="flex-1 text-body-sm text-text-primary" aria-live="assertive">
              <span className="font-semibold">{pending.description}</span>
              {' — applying to '}
              {pending.count} row{pending.count === 1 ? '' : 's'} in {pending.secondsLeft}s
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={onUndo}>
                <Undo2 className="w-4 h-4" />
                Undo
              </Button>
              <Button size="sm" variant="outline" onClick={onApplyNow}>
                Apply now
              </Button>
            </div>
          </>
        ) : running ? (
          <p className="flex items-center gap-2 text-body-sm text-text-primary" aria-live="polite">
            <Spinner size="sm" />
            Applying changes…
          </p>
        ) : (
          <>
            <p className="text-body-sm font-semibold text-text-primary whitespace-nowrap">
              {count} selected
            </p>
            <div className="flex flex-wrap items-center gap-2 flex-1">{children}</div>
            <Button size="sm" variant="ghost" onClick={onClear}>
              <X className="w-4 h-4" />
              Clear
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
