/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Matches app/admin/stock/page.tsx: heading, the four summary cards, the
// filter row, then StockTable's six columns (a selection column plus five).
import { Skeleton } from '@/components/ui';
import { AdminSummaryCardsSkeleton, AdminTableSkeleton } from '@/app/admin/components/AdminSkeletons';

export function StockSkeleton() {
  return (
    <div className="p-4 md:p-6 lg:p-8" aria-busy="true" aria-label="Loading stock">
      <div className="mb-6 md:mb-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-5 w-56" />
      </div>

      <AdminSummaryCardsSkeleton count={4} />

      {/* The search box, three selects and the low-stock threshold input. */}
      <div className="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-11" />
        ))}
      </div>

      <AdminTableSkeleton columns={6} rows={8} leadingThumbnail />
    </div>
  );
}
