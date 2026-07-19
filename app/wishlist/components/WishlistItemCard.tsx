/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Heart } from 'lucide-react';
import { ProductCardProduct } from '@/types/product';
import ProductCard from '@/components/commerce/ProductCard';
import { useWishlist } from '@/components/WishlistProvider';

export default function WishlistItemCard({ product }: { product: ProductCardProduct }) {
  const { removeFromWishlist } = useWishlist();

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          removeFromWishlist(product.id);
        }}
        className="absolute -top-2 -right-2 z-20 bg-surface rounded-full p-1.5 shadow-elevation-2 hover:bg-surface-hover"
        aria-label="Remove from wishlist"
      >
        <Heart className="w-4 h-4 fill-destructive text-destructive" />
      </button>
      <ProductCard product={product} />
    </div>
  );
}
