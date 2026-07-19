/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import Link from 'next/link';
import { useWishlist } from '@/components/WishlistProvider';
import WishlistItemCard from './components/WishlistItemCard';

export default function WishlistPage() {
  const { items } = useWishlist();

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center overflow-x-hidden">
        <div className="max-w-md mx-auto">
          <h1 className="text-h5 sm:text-h4 font-bold mb-4">Your wishlist is empty</h1>
          <p className="text-text-secondary text-body-sm sm:text-body-md mb-8">
            Tap the heart on a product to save it here for later.
          </p>
          <Link
            href="/products"
            className="inline-block bg-primary text-primary-foreground px-4 sm:px-6 py-2 sm:py-3 rounded-control font-semibold text-body-sm sm:text-body-md hover:bg-primary-hover"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-h3 font-extrabold text-text-primary tracking-tight mb-8">Your Wishlist</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(product => (
          <WishlistItemCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
