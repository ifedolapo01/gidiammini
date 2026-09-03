/**
 * STOREFRONT layer — "Load more", and what it says when there is no more.
 *
 * An explicit button rather than infinite scroll, deliberately. Infinite scroll
 * makes the footer unreachable — every time you approach it another page pushes
 * it away — and it takes the decision away from someone on metered mobile data
 * who did not ask for the next twenty-four product images.
 *
 * The end of the list is stated rather than left as an absence, so a shopper
 * knows they have seen everything instead of wondering whether it is still
 * loading.
 */
'use client';

import { Button } from '@/components/ui';

interface LoadMoreButtonProps {
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  loadedCount: number;
  total: number | null;
  onLoadMore: () => void;
}

export default function LoadMoreButton({
  hasMore,
  loading,
  error,
  loadedCount,
  total,
  onLoadMore,
}: LoadMoreButtonProps) {
  // An empty listing has its own empty state in the grid; this would just be a
  // second thing saying nothing is here.
  if (loadedCount === 0) return null;

  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      {error && (
        <p role="alert" className="text-body-sm text-destructive">
          {error}
        </p>
      )}

      {hasMore ? (
        <>
          <Button variant="outline" size="lg" loading={loading} onClick={onLoadMore}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
          {/* aria-live so the count is announced after each press — the newly
              appended cards are below the button and easy to miss. */}
          <p aria-live="polite" className="text-caption-md text-text-muted">
            {total === null
              ? `${loadedCount} shown`
              : `${loadedCount} of ${total} shown`}
          </p>
        </>
      ) : (
        <p className="text-caption-md text-text-muted">
          {loadedCount === 1 ? "That's the only match." : "You've reached the end of the collection."}
        </p>
      )}
    </div>
  );
}
