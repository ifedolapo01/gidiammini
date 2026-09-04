/**
 * STOREFRONT layer — "goes well with this", inside the cart drawer.
 *
 * Compact rows rather than ProductRail: the rail's grid breakpoints are
 * viewport-based, so on a desktop it would lay four cards out inside a 32rem
 * panel. Same data source as the cart page's rail — real co-purchases, not a
 * category guess — and the same price logic as a full card, through
 * getCardPricing.
 *
 * A link, not an add button: size and colour are required to add anything, and
 * a one-tap "add" here could not honour that.
 */
'use client';

import Link from 'next/link';
import ProductImage from '@/components/commerce/ProductImage';
import { useRecommendations } from '@/components/commerce/hooks/useRecommendations';
import { formatPriceRange } from '@/lib/commerce/pricing';
import { getCardPricing } from '@/lib/commerce/card-pricing';

/** Three is what fits above the footer without pushing the cart itself out of
 *  view — the suggestion must not outrank what they already chose. */
const MAX_SUGGESTIONS = 3;

interface CartDrawerCrossSellProps {
  /** Product ids currently in the cart. */
  productIds: string[];
}

export default function CartDrawerCrossSell({ productIds }: CartDrawerCrossSellProps) {
  const { products, discounts } = useRecommendations({ type: 'cart', ids: productIds });
  const suggestions = products.slice(0, MAX_SUGGESTIONS);

  // Silence when there is nothing worth suggesting, as with every other rail:
  // a heading over an empty box reads as something that failed to load.
  if (suggestions.length === 0) return null;

  return (
    <section aria-labelledby="cart-drawer-cross-sell" className="border-t border-divider pt-4">
      <h3 id="cart-drawer-cross-sell" className="text-body-sm font-semibold text-text-primary">
        Goes well with this
      </h3>
      <p className="mt-0.5 text-caption-md text-text-secondary">
        Delivery is charged per order — adding to this one costs nothing more to ship.
      </p>

      <ul className="mt-2 divide-y divide-divider">
        {suggestions.map((product) => {
          const { min, max, finalMin, finalMax, discount } = getCardPricing(product, discounts);

          return (
            <li key={product.id}>
              <Link
                href={`/products/${product.id}`}
                className="flex items-center gap-3 py-2 rounded-control hover:bg-surface-hover"
              >
                <ProductImage
                  src={product.main_image || product.image}
                  alt={product.name}
                  className="w-12 aspect-square rounded-surface flex-shrink-0"
                  sizes="48px"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm text-text-primary line-clamp-1">{product.name}</p>
                  <p className="text-caption-md">
                    {discount ? (
                      <>
                        <span className="text-text-muted line-through">
                          {formatPriceRange(min, max)}
                        </span>{' '}
                        <span className="font-semibold text-destructive">
                          {formatPriceRange(finalMin, finalMax)}
                        </span>
                      </>
                    ) : (
                      <span className="text-text-secondary">{formatPriceRange(min, max)}</span>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
