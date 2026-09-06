/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Matches app/admin/settings/page.tsx: the page header, then four cards of
// two-column fields.
import { Skeleton } from '@/components/ui';
import { AdminPageHeaderSkeleton } from '@/app/admin/components/AdminSkeletons';

/** Rows of fields per card, in page order: identity (3), bank (4),
 *  pricing and stock (6), notifications (4). */
const FIELD_COUNTS = [3, 4, 6, 4];

export function SettingsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6" aria-busy="true" aria-label="Loading settings">
      <AdminPageHeaderSkeleton />
      {FIELD_COUNTS.map((fields, card) => (
        <section
          key={card}
          className="bg-surface border border-border rounded-surface shadow-elevation-1 p-4 sm:p-6"
          aria-hidden="true"
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: fields }, (_, field) => (
              <div key={field}>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-1 h-11 w-full" />
                <Skeleton className="mt-1 h-3 w-48 max-w-full" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
