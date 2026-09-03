/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Matches AnalyticsSection: a Trends heading with the range toggle over two
// charts, then an All-Time heading over two more. Each card reserves the
// ChartCard title plus the 280px plot area, so the dashboard below it does not
// jump when the real charts render.
import { Skeleton } from '@/components/ui';

function ChartCardSkeleton() {
  return (
    <div className="rounded-surface border border-border bg-surface p-6 shadow-elevation-1">
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="h-[280px] w-full" />
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="mb-8" aria-busy="true" aria-label="Loading analytics">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>

      <Skeleton className="mb-4 h-6 w-52" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
