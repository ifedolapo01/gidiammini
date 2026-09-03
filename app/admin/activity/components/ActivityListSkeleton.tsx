/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Only the list. The activity page renders its header and filter row outside
// the loading branch, so this stands in for ActivityTable alone — and it sits
// inside the page's own bordered container, so it brings no chrome of its own.
import { AdminTableSkeleton } from '@/app/admin/components/AdminSkeletons';

export function ActivityListSkeleton() {
  // aria-busy on the wrapper, matching the other admin screens: the table
  // skeleton inside is aria-hidden, so without this a screen reader is told
  // nothing at all while the feed loads.
  return (
    <div aria-busy="true" aria-label="Loading activity">
      <AdminTableSkeleton columns={6} rows={8} className="overflow-hidden" />
    </div>
  );
}
