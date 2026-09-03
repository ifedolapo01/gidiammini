/** ADMIN layer — depends only on Core (tokens + primitives). No storefront branding. */
// Matches app/admin/categories/page.tsx: the two add-forms stacked in the left
// third, the category list in the right two thirds.
import { Skeleton } from '@/components/ui';
import { AdminPageHeaderSkeleton } from '@/app/admin/components/AdminSkeletons';

/** An add-form card: heading, two labelled fields, submit. */
function FormCardSkeleton() {
  return (
    <div className="rounded-surface border border-border bg-surface p-6 shadow-elevation-1">
      <Skeleton className="mb-6 h-6 w-44" />
      {Array.from({ length: 2 }, (_, field) => (
        <div key={field} className="mb-4">
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

export function CategoriesSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8" aria-busy="true" aria-label="Loading categories">
      <AdminPageHeaderSkeleton className="flex justify-between items-center mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <FormCardSkeleton />
          <FormCardSkeleton />
        </div>

        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }, (_, category) => (
            <div key={category} className="rounded-surface border border-border bg-surface p-6 shadow-elevation-1">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-9 w-9 rounded-control" />
              </div>
              {/* The subcategory chips under each category. */}
              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from({ length: 4 }, (_, sub) => (
                  <Skeleton key={sub} className="h-8 w-28 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
