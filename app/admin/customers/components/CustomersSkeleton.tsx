/** ADMIN layer — the shape of the customer list while it loads.
 *
 * A skeleton the same height as the real thing, so the page does not jump when
 * the rows arrive — the same reason OrdersSkeleton exists.
 */
import { Skeleton } from '@/components/ui';

export function CustomersSkeleton() {
  return (
    <div className="p-4 md:p-6 lg:p-8" aria-busy="true" aria-label="Loading customers">
      <Skeleton className="mb-2 h-8 w-56" />
      <Skeleton className="mb-6 h-5 w-72" />

      <div className="mb-4 flex gap-3">
        <Skeleton className="h-11 flex-1" />
        <Skeleton className="h-11 w-48" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
