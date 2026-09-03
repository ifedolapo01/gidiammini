/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Matches app/admin/stock/page.tsx: header with the low-stock threshold input,
// the four summary cards, then StockTable's five columns.
import { Skeleton } from '@/components/ui';
import { AdminSummaryCardsSkeleton, AdminTableSkeleton } from '@/app/admin/components/AdminSkeletons';

export function StockSkeleton() {
  return (
    <div className="p-4 md:p-6 lg:p-8" aria-busy="true" aria-label="Loading stock">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-5 w-56" />
        </div>
        {/* "Low Stock Threshold:" label plus its narrow number input. */}
        <div className="mt-4 flex items-center gap-2 md:mt-0">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <AdminSummaryCardsSkeleton count={4} />
      <AdminTableSkeleton columns={5} rows={8} leadingThumbnail />
    </div>
  );
}
