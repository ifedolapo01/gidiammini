/** ADMIN layer — what this buyer has saved and not bought.
 *
 * The cheapest sales signal a small shop has: somebody has said "I want this"
 * without spending anything. Shown on the customer rather than only in the
 * aggregate wishlist report because the useful version of the question is
 * personal — "she has been eyeing these three since March" is a phone call,
 * "gown X has 40 saves" is a restocking decision.
 *
 * The stock figure earns its place: a saved item that is back in stock is the
 * one worth mentioning, and a saved item that is not is a message that would
 * only annoy.
 */
import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';
import type { CustomerWishlistEntry } from '@/types/customer';

export default function CustomerWishlist({ items }: { items: CustomerWishlistEntry[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-surface border border-border bg-background-secondary p-4 text-body-sm text-text-secondary">
        Nothing saved. A wishlist only exists once somebody signs in and hearts something.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((entry) => {
        const product = entry.products;
        const inStock = (product?.stock ?? 0) > 0;

        return (
          <li
            key={entry.product_id}
            className="flex items-center justify-between gap-3 rounded-surface border border-border bg-surface p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-body-sm font-medium text-text-primary">
                {product?.name ?? 'A product that no longer exists'}
              </p>
              <p className="text-caption-md text-text-secondary">
                Saved {formatDate(entry.created_at)}
              </p>
            </div>

            <div className="shrink-0 text-right">
              {product && (
                <p className="text-body-sm font-medium text-text-primary">
                  {formatCurrency(product.price)}
                </p>
              )}
              <Badge tone={inStock ? 'success' : 'neutral'} className="mt-1">
                {inStock ? `${product?.stock} in stock` : 'Out of stock'}
              </Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
