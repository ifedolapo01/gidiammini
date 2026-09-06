/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Matches PeriodSection: five compared stat cards, then two breakdown panels.
import { Skeleton } from '@/components/ui';
import { AdminSummaryCardsSkeleton } from '@/app/admin/components/AdminSkeletons';

export function PeriodSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading period figures">
      <AdminSummaryCardsSkeleton
        count={5}
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-hidden="true">
        {[0, 1].map((panel) => (
          <section key={panel} className="rounded-surface border border-border bg-surface shadow-elevation-1">
            <div className="border-b border-border-light p-4 sm:p-5">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="mt-2 h-3 w-64 max-w-full" />
            </div>
            <div className="divide-y divide-border-light">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="p-4">
                  <div className="flex justify-between gap-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
                  <Skeleton className="mt-2 h-3 w-40" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
