/**
 * ADMIN layer — what /admin/activity shows while the route is being fetched.
 *
 * Unlike the other routes this is not a straight re-export: the page renders
 * its header and filter row outside its loading branch, so ActivityListSkeleton
 * covers only the table. Here nothing is on screen yet, so the whole page has
 * to be stood up — same padding, same header sizes, so nothing shifts when the
 * real page replaces it.
 */
import { Skeleton } from '@/components/ui';
import { ActivityListSkeleton } from './components/ActivityListSkeleton';

export default function ActivityLoading() {
  return (
    <div className="p-3 sm:p-6 space-y-4">
      <header aria-hidden="true">
        <Skeleton className="h-7 w-32 sm:h-8" />
        <Skeleton className="mt-2 h-4 w-full max-w-lg" />
      </header>

      {/* ActivityFilters: a row of selects and a date range. */}
      <div className="flex flex-wrap gap-3" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-11 w-40" />
        ))}
      </div>

      <div className="bg-surface border border-border rounded-surface overflow-hidden">
        <ActivityListSkeleton />
      </div>
    </div>
  );
}
