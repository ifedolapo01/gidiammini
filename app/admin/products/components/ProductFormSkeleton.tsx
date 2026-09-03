/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// The new/edit product form while an existing product loads. Mirrors the shell
// the real form renders into — the max-w-4xl column under the back link — and
// the field groups inside it, so the page does not resize once the values
// arrive.
import { Skeleton } from '@/components/ui';

function FieldSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <Skeleton className="mb-2 h-4 w-28" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

export function ProductFormSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading product">
      {/* Details card. */}
      <div className="rounded-surface border border-border bg-surface p-6 shadow-elevation-1">
        <Skeleton className="mb-6 h-6 w-44" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldSkeleton wide />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="mt-4">
          <Skeleton className="mb-2 h-4 w-28" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>

      {/* Images card — the dropzone plus a row of thumbnails. */}
      <div className="rounded-surface border border-border bg-surface p-6 shadow-elevation-1">
        <Skeleton className="mb-6 h-6 w-40" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-surface" />
          ))}
        </div>
      </div>

      {/* Variants / pricing card. */}
      <div className="rounded-surface border border-border bg-surface p-6 shadow-elevation-1">
        <Skeleton className="mb-6 h-6 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>

      <Skeleton className="h-12 w-full" />
    </div>
  );
}
