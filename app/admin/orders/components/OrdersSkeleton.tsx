/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Matches app/admin/orders/page.tsx: header, the search + status filter bar,
// then the order cards. Same p-4 md:p-6 lg:p-8 padding, so nothing shifts
// sideways when the real screen replaces it.
import { Skeleton } from '@/components/ui';
import { AdminPageHeaderSkeleton, AdminCardGridSkeleton } from '@/app/admin/components/AdminSkeletons';

export function OrdersSkeleton() {
  return (
    <div className="p-4 md:p-6 lg:p-8" aria-busy="true" aria-label="Loading orders">
      <AdminPageHeaderSkeleton />

      {/* OrderFilters: a search field that grows, then the status buttons. */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <Skeleton className="h-11 flex-1" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-24" />
            ))}
          </div>
        </div>
      </div>

      <AdminCardGridSkeleton count={4} />
    </div>
  );
}
