/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Matches app/admin/stock/reports/page.tsx: header, three summary cards, then
// three panels of rows.
import { Skeleton } from '@/components/ui';
import {
  AdminPageHeaderSkeleton,
  AdminSummaryCardsSkeleton,
  AdminTableSkeleton,
} from '@/app/admin/components/AdminSkeletons';

export function ReportsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" aria-busy="true" aria-label="Loading stock reports">
      <AdminPageHeaderSkeleton hasAction className="flex flex-wrap justify-between items-start gap-3" />
      <AdminSummaryCardsSkeleton count={3} className="grid grid-cols-1 sm:grid-cols-3 gap-4" />

      {[6, 5, 4].map((rows, panel) => (
        <section
          key={panel}
          className="bg-surface border border-border rounded-surface shadow-elevation-1 overflow-hidden"
          aria-hidden="true"
        >
          <div className="p-4 sm:p-6 border-b border-border-light">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          </div>
          <AdminTableSkeleton columns={5} rows={rows} leadingThumbnail={false} />
        </section>
      ))}
    </div>
  );
}
