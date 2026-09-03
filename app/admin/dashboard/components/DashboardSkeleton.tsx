/**
 * ADMIN layer — the dashboard's shape while its data loads.
 * Depends only on Core (tokens + primitives). No storefront branding.
 *
 * Replaces a centred spinner on an otherwise empty page. The spinner said
 * "something is happening"; this says what is about to be there, in the place
 * it will be, so the screen assembles rather than appearing all at once.
 *
 * Composed from the shared admin skeletons rather than hand-rolled. It was
 * hand-rolled first, and the moment the other seven screens needed the same
 * header and the same card row it became the first of eight copies.
 */
import { Skeleton } from '@/components/ui';
import {
  AdminPageHeaderSkeleton,
  AdminSummaryCardsSkeleton,
} from '@/app/admin/components/AdminSkeletons';
import { AnalyticsSkeleton } from './AnalyticsSkeleton';

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <AdminPageHeaderSkeleton hasAction />

      {/* Five stat cards: 2-up on tablet, 3-up on laptop, five across on a wide
          screen — the same grid page.tsx uses. */}
      <AdminSummaryCardsSkeleton
        count={5}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6 mb-8"
      />

      <AnalyticsSkeleton />

      {/* Recent orders + low stock, side by side from lg. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {Array.from({ length: 2 }, (_, panel) => (
          <div key={panel} className="rounded-surface border border-border bg-surface p-6">
            <Skeleton className="mb-6 h-6 w-40" />
            <div className="space-y-4">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 shrink-0 rounded-control" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
