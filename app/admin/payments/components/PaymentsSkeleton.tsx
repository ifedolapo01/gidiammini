/** ADMIN layer — the verification queue's shape while it loads.
 *
 * Composed from the shared admin skeletons, matching the two-column layout
 * page.tsx settles into, so the screen assembles in place rather than jumping
 * once the data lands. That matters more here than elsewhere: this screen is
 * opened on a phone on a slow connection, and a layout that shifts under a
 * thumb is a layout that gets the wrong button pressed.
 */
import { Skeleton } from '@/components/ui';
import {
  AdminPageHeaderSkeleton,
  AdminSummaryCardsSkeleton,
} from '@/app/admin/components/AdminSkeletons';

export function PaymentsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the verification queue">
      <AdminPageHeaderSkeleton />

      <AdminSummaryCardsSkeleton count={3} className="grid grid-cols-3 gap-2 sm:gap-3 mb-4" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="rounded-surface border border-border bg-surface p-3">
          <Skeleton className="mb-3 h-5 w-24" />
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, row) => (
              <div key={row} className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-surface border border-border bg-surface p-4">
            <Skeleton className="mb-2 h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="rounded-surface border border-border bg-surface">
            <div className="grid grid-cols-2 gap-px">
              <Skeleton className="h-16 rounded-none" />
              <Skeleton className="h-16 rounded-none" />
            </div>
            <div className="p-3">
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
          <div className="rounded-surface border border-border bg-surface p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
            <Skeleton className="mt-4 h-12" />
            <Skeleton className="mt-4 h-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
