/** ADMIN layer — what actually happened to each row of a bulk action.
 *
 * A bulk endpoint that answers "failed" for 1 row out of 60 tells the operator
 * nothing they can act on, and one that answers "done" while quietly skipping
 * rows is worse. Every failure is listed by name with the reason the server
 * gave; successes are counted, not listed.
 */
'use client';

import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import type { BulkOutcome } from '@/lib/api/bulk';

interface BulkResultSummaryProps {
  outcome: (BulkOutcome & { description: string }) | null;
  onDismiss: () => void;
}

export default function BulkResultSummary({ outcome, onDismiss }: BulkResultSummaryProps) {
  if (!outcome) return null;

  const failures = outcome.results.filter((result) => !result.ok);
  const clean = failures.length === 0 && outcome.succeeded > 0;

  return (
    <div
      role="status"
      className={`mt-4 rounded-surface border p-4 ${
        clean
          ? 'bg-success-background border-success-border'
          : 'bg-warning-background border-warning-border'
      }`}
    >
      <div className="flex items-start gap-3">
        {clean ? (
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary">
            {outcome.description}: {outcome.succeeded} succeeded
            {outcome.failed > 0 && `, ${outcome.failed} failed`}
          </p>

          {failures.length > 0 && (
            <ul className="mt-2 space-y-1 text-body-sm text-text-secondary">
              {failures.map((failure) => (
                <li key={failure.id}>
                  <span className="font-medium text-text-primary">{failure.label || failure.id}</span>
                  {' — '}
                  {failure.error || 'Unknown error'}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss result summary"
          className="flex-shrink-0 p-1 rounded-control text-text-secondary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
