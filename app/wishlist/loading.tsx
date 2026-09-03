/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
import { Skeleton } from '@/components/ui';
import { ProductGridSkeleton } from '@/components/commerce/ProductCardSkeleton';

export default function WishlistLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="mb-8 h-9 w-56" />
      <ProductGridSkeleton count={3} />
    </div>
  );
}
