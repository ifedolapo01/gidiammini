/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// What /products shows while the server is still querying.
//
// Not a loading.tsx. A loading.tsx at app/products/ would wrap this segment AND
// its children, and /products/[id] is a child: the Suspense boundary makes Next
// stream the response, which flushes 200 headers before the page function runs,
// and the product page's notFound() then renders a 404 body under a 200 status.
// Verified — with app/products/loading.tsx present, an unknown product id
// answered 200; without it, 404. So the boundary lives inside page.tsx instead,
// where it covers this route and nothing else.
import { Skeleton } from '@/components/ui';
import { ProductGridSkeleton } from '@/components/commerce/ProductCardSkeleton';

export default function ProductsListingSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-8 md:flex-row">
        {/* The filter rail, which is md-and-up only — same as the real one. */}
        <div className="hidden w-64 shrink-0 md:block" aria-hidden="true">
          <Skeleton className="mb-6 h-6 w-24" />
          {Array.from({ length: 4 }, (_, section) => (
            <div key={section} className="mb-8">
              <Skeleton className="mb-3 h-5 w-32" />
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, row) => (
                  <Skeleton key={row} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {/* Title + count on the left, sort control on the right. */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Skeleton className="h-9 w-64" />
              <Skeleton className="mt-2 h-5 w-40" />
            </div>
            <Skeleton className="h-11 w-44" />
          </div>

          {/* PAGE_SIZE is 24, but a skeleton only needs to fill the fold —
              drawing 24 makes the page taller than the results usually are. */}
          <ProductGridSkeleton count={6} />
        </div>
      </div>
    </div>
  );
}
