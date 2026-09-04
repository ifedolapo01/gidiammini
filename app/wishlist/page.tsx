/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import Link from 'next/link';
import { useWishlist } from '@/components/WishlistProvider';
import WishlistItemCard from './components/WishlistItemCard';
import { ProductCardSkeleton } from '@/components/commerce/ProductCardSkeleton';
import { useWishlistCards } from './hooks/useWishlistCards';

export default function WishlistPage() {
  const { ids } = useWishlist();
  // The list stores ids; the cards are looked up live, so nothing here can be
  // showing a price from the week it was saved. See useWishlistCards.
  const { items, discounts, loaded } = useWishlistCards(ids);

  if (ids.length === 0) {
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

      {/* One skeleton per saved id: the count is known before the cards are,
          so the page does not jump as they land. */}
      {!loaded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ids.map((id) => (
            <ProductCardSkeleton key={id} />
          ))}
        </div>
      )}

      {loaded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((product) => (
            <WishlistItemCard key={product.id} product={product} discounts={discounts} />
          ))}
        </div>
      )}

      {/* Saved, but no longer sellable. Said plainly rather than leaving the
          shopper to wonder why the page is emptier than the heart count. */}
      {loaded && items.length < ids.length && (
        <p className="mt-6 text-body-sm text-text-secondary">
          {ids.length - items.length === 1
            ? 'One saved product is no longer available and is not shown.'
            : `${ids.length - items.length} saved products are no longer available and are not shown.`}
        </p>
      )}
    </div>
  );
}
