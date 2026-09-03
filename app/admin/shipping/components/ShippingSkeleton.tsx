/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Matches app/admin/shipping/page.tsx: header with Add Zone, then
// ShippingZoneTable's six columns (zone, delivery, pickup, contact, status,
// actions).
import { AdminPageHeaderSkeleton, AdminTableSkeleton } from '@/app/admin/components/AdminSkeletons';

export function ShippingSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8" aria-busy="true" aria-label="Loading shipping zones">
      <AdminPageHeaderSkeleton hasAction className="flex justify-between items-center mb-6" />
      <AdminTableSkeleton
        columns={6}
        rows={6}
        className="bg-surface rounded-surface shadow-elevation-1 border border-border-light overflow-hidden mb-8"
      />
    </div>
  );
}
