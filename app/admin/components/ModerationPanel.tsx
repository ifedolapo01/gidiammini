/**
 * ADMIN layer — the frame around a moderation queue: states and paging.
 *
 * Shared by the review and question queues, which had identical shells: a
 * bordered surface holding one of four states (loading, failed, empty, a list)
 * and a pager under it. The cards inside are the only thing that differs, so
 * they arrive as children.
 *
 * The failed state is this inline panel rather than Core's ErrorState — that
 * one is the full-page boundary and would take over the page for a list that
 * did not load.
 */
'use client';

import type { ReactNode } from 'react';
import { Button, Spinner } from '@/components/ui';

interface ModerationPanelProps {
  loading: boolean;
  error: string;
  onRetry: () => void;
  /** True when the query succeeded and returned nothing. */
  empty: boolean;
  emptyMessage: string;
  loadingMessage: string;
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  /** What one page is counted in — "review", "question". */
  noun: string;
  children: ReactNode;
}

const PAGER_BUTTON =
  'h-11 rounded-control px-3 text-body-sm font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export default function ModerationPanel({
  loading,
  error,
  onRetry,
  empty,
  emptyMessage,
  loadingMessage,
  page,
  pageCount,
  total,
  onPageChange,
  noun,
  children,
}: ModerationPanelProps) {
  return (
    <>
      <div className="overflow-hidden rounded-surface border border-border bg-surface">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-body-sm text-text-secondary">
            <Spinner size="md" />
            {loadingMessage}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="m-3 rounded-control border border-destructive-border bg-destructive-background p-3 text-body-sm text-destructive"
          >
            {error}
            <Button variant="outline" size="sm" className="ml-3" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : empty ? (
          <p className="p-10 text-center text-body-sm text-text-secondary">{emptyMessage}</p>
        ) : (
          <ul>{children}</ul>
        )}
      </div>

      {pageCount > 1 && !loading && !error && (
        <nav className="mt-4 flex items-center justify-between" aria-label={`${noun} pages`}>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            className={PAGER_BUTTON}
          >
            ← Previous
          </button>
          <p className="text-caption-md text-text-secondary" aria-live="polite">
            Page {page + 1} of {pageCount} · {total} {total === 1 ? noun : `${noun}s`}
          </p>
          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => onPageChange(page + 1)}
            className={PAGER_BUTTON}
          >
            Next →
          </button>
        </nav>
      )}
    </>
  );
}
