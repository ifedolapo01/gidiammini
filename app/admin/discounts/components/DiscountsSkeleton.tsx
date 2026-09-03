/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Matches app/admin/discounts/page.tsx: the max-w-6xl column, a header with
// Create Discount, then two DiscountTables — active and history — each five
// columns wide.
import { AdminPageHeaderSkeleton, AdminTableSkeleton } from '@/app/admin/components/AdminSkeletons';

export function DiscountsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8" aria-busy="true" aria-label="Loading discounts">
      <AdminPageHeaderSkeleton hasAction className="flex justify-between items-center mb-6" />
      <AdminTableSkeleton
        columns={5}
        rows={4}
        className="bg-surface rounded-surface shadow-elevation-1 border border-border-light overflow-hidden mb-8"
      />
      <AdminTableSkeleton
        columns={5}
        rows={3}
        className="bg-surface rounded-surface shadow-elevation-1 border border-border-light overflow-hidden mb-8"
      />
    </div>
  );
}
