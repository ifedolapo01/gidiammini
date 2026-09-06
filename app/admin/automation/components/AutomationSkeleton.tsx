/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Matches app/admin/automation/page.tsx: the header, then a card per rule.
import { Skeleton } from '@/components/ui';
import { AdminPageHeaderSkeleton } from '@/app/admin/components/AdminSkeletons';

export function AutomationSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6" aria-busy="true" aria-label="Loading automation rules">
      <AdminPageHeaderSkeleton />
      {[0, 1, 2].map((card) => (
        <section
          key={card}
          className="rounded-surface border border-border bg-surface p-4 shadow-elevation-1 sm:p-5"
          aria-hidden="true"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="mt-2 h-4 w-full max-w-md" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-3 w-64 max-w-full" />
        </section>
      ))}
    </div>
  );
}
