/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Only the table. Unlike the other admin screens, page.tsx here renders its
// header, filters and the Add New Product action outside the loading branch,
// so those are already on screen — this stands in for ProductsTable alone:
// eight columns (a selection column plus seven), a thumbnail in the second.
import { AdminTableSkeleton } from '@/app/admin/components/AdminSkeletons';

export function ProductsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading products">
      <AdminTableSkeleton
        columns={8}
        rows={6}
        leadingThumbnail
        className="bg-surface rounded-surface border border-border overflow-hidden"
      />
    </div>
  );
}
