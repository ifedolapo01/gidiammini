/** ADMIN layer — "Most wishlisted" card on the dashboard. */
// What people want that they have not bought.
//
// The other panels report what happened; this one reports what has not
// happened yet. Ordered by unmet demand rather than raw popularity — see
// lib/commerce/wishlist-demand.ts — so the top of the list is a restocking
// order rather than a chart.
'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import ProductImage from '@/components/commerce/ProductImage';
import { StockBadge } from '@/components/commerce/StockBadge';
import { useWishlistDemand } from '../hooks/useWishlistDemand';

export function WishlistDemandPanel() {
  const { products, loading, error } = useWishlistDemand();

  return (
    <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-h5 font-bold text-text-primary">Most Wishlisted</h2>
          <p className="text-body-sm text-text-secondary mt-0.5">
            Saved but not bought — sold-out items first.
          </p>
        </div>
        <Link
          href="/admin/stock"
          className="text-primary hover:text-primary-hover text-body-sm font-medium whitespace-nowrap"
        >
          Restock
        </Link>
      </div>

      {loading && (
        <div className="space-y-4" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-4 p-3">
              <div className="h-12 w-12 animate-pulse rounded-control bg-background-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded bg-background-secondary" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-background-secondary" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <p role="alert" className="py-8 text-center text-body-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="text-center py-8">
          <Heart className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">Nobody has saved a product yet</p>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <ul className="space-y-4">
          {products.map((product) => (
            <li key={product.productId}>
              <Link
                href={`/admin/products/${product.productId}`}
                className="flex items-center p-3 rounded-control hover:bg-surface-hover"
              >
                <ProductImage
                  src={product.image ?? ''}
                  alt={product.name}
                  className="w-12 h-12 rounded-control mr-4 flex-shrink-0"
                  sizes="48px"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary truncate">{product.name}</p>
                  <p className="text-body-sm text-text-secondary">
                    Saved by {product.savedBy} {product.savedBy === 1 ? 'customer' : 'customers'}
                  </p>
                </div>
                <div className="ml-3 text-right">
                  {/* Only when it is the point: a healthy stock level is not
                      why this row is on the list. */}
                  <StockBadge stock={product.stock} countFormat="colon" />
                  {!product.unmet && (
                    <p className="text-caption-md text-text-secondary">{product.stock} in stock</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
