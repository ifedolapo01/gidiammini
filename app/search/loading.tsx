/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
import { Skeleton } from '@/components/ui';
import { ProductGridSkeleton } from '@/components/commerce/ProductCardSkeleton';

export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="container mx-auto px-3 sm:px-4 py-6">
        <Skeleton className="mb-6 h-7 w-64" />
        <ProductGridSkeleton count={6} />
      </div>
    </div>
  );
}
