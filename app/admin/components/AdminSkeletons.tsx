/**
 * ADMIN layer — the shapes admin screens take while their data loads.
 * Depends only on Core (tokens + primitives). No storefront branding.
 *
 * Every admin page used to answer "still loading" with the same centred
 * spinner on an empty page: no header, no title, no sense of what was coming.
 * These are the pieces those pages are actually built from — a header, a table,
 * a row of summary cards, a list of cards — so a loading screen can be
 * assembled from the same parts as the screen it stands in for.
 *
 * Shared rather than written per page because they were about to be written
 * eight times. The measurements here mirror the real components: the table
 * chrome matches ProductsTable/DiscountTable/StockTable, the summary cards
 * match StockSummaryCards, the card grid matches OrderCard.
 */
import { Skeleton } from '@/components/ui';

interface AdminPageHeaderSkeletonProps {
  /** Reserves space for the header's action button (Add Product, Create
   *  Discount…). Pages without one pass false so nothing floats on the right. */
  hasAction?: boolean;
  className?: string;
}

export function AdminPageHeaderSkeleton({
  hasAction = false,
  className = 'flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8',
}: AdminPageHeaderSkeletonProps) {
  return (
    <div className={className}>
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-5 w-80 max-w-full" />
      </div>
      {hasAction && <Skeleton className="mt-4 h-11 w-40 md:mt-0" />}
    </div>
  );
}

interface AdminTableSkeletonProps {
  /** How many columns the real table has, so the header row lines up. */
  columns: number;
  rows?: number;
  /** The first cell of each row is usually a thumbnail plus two lines of text
   *  (product, stock, orders). Off for tables that are text-only. */
  leadingThumbnail?: boolean;
  className?: string;
}

export function AdminTableSkeleton({
  columns,
  rows = 6,
  leadingThumbnail = false,
  className = 'bg-surface rounded-surface shadow-elevation-1 border border-border overflow-hidden',
}: AdminTableSkeletonProps) {
  return (
    <div className={className} aria-hidden="true">
      {/* Header band — bg-background-secondary, same as every admin thead. */}
      <div className="flex items-center gap-6 border-b border-border bg-background-secondary px-6 py-3">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className={`h-3 ${index === 0 ? 'w-28' : 'flex-1'}`} />
        ))}
      </div>

      <div className="divide-y divide-divider">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex items-center gap-6 px-6 py-4">
            {leadingThumbnail ? (
              <div className="flex w-28 shrink-0 items-center gap-3">
                <Skeleton className="h-12 w-12 shrink-0 rounded-control" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-1.5 h-3 w-2/3" />
                </div>
              </div>
            ) : (
              <Skeleton className="h-4 w-28 shrink-0" />
            )}
            {Array.from({ length: columns - 1 }, (_, cell) => (
              <Skeleton key={cell} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AdminSummaryCardsSkeletonProps {
  count?: number;
  /** The real grid classes, passed rather than guessed — stock is 2-up then
   *  4-up, the dashboard is 2/3/5-up. */
  className?: string;
}

export function AdminSummaryCardsSkeleton({
  count = 4,
  className = 'grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 md:mb-8',
}: AdminSummaryCardsSkeletonProps) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-surface border border-border bg-surface p-4 shadow-elevation-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

interface AdminCardGridSkeletonProps {
  count?: number;
  className?: string;
}

/** For screens that list records as cards rather than table rows — orders. */
export function AdminCardGridSkeleton({
  count = 4,
  className = 'grid gap-4 md:gap-6',
}: AdminCardGridSkeletonProps) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-surface border border-border bg-surface shadow-elevation-1">
          <div className="p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="mt-2 h-4 w-64 max-w-full" />
              </div>
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
