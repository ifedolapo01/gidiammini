/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives). */
// Safe as a loading.tsx: /cart is a leaf segment with no children, so this
// boundary cannot leak onto a route that calls notFound(). (app/products/ is
// the counter-example — see app/products/components/ProductsListingSkeleton.)
import { Skeleton } from '@/components/ui';

export default function CartLoading() {
  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <Skeleton className="mb-6 h-9 w-48" />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center rounded-surface bg-surface p-4 shadow-elevation-1">
              {/* Matches the cart line's w-16 sm:w-20 md:w-24 square thumbnail. */}
              <Skeleton className="aspect-square w-16 shrink-0 rounded-surface sm:w-20 md:w-24" />
              <div className="ml-3 flex-1 sm:ml-4 md:ml-6">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-2 h-4 w-1/3" />
                <Skeleton className="mt-4 h-9 w-32" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-64 rounded-surface" />
      </div>
    </div>
  );
}
