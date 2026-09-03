/**
 * COMMERCE layer — a titled row of product cards.
 *
 * One component behind all three recommendation surfaces, so "You might also
 * like", "Customers also bought" and "Recently viewed" are the same object with
 * different contents rather than three rails that drift apart.
 *
 * It renders nothing at all when it has nothing to show. A rail is a
 * suggestion, and an empty box with a heading over it is worse than silence —
 * it reads as something that failed to load.
 *
 * Horizontal scroll on narrow screens, a grid once there is room. The scroller
 * is a list with a real accessible name, so it is navigable rather than a strip
 * of cards a screen reader meets with no explanation.
 */
import ProductCard from './ProductCard';
import type { ProductCardProduct } from '@/types/product';
import type { Discount } from '@/lib/commerce/discounts';

interface ProductRailProps {
  title: string;
  products: ProductCardProduct[];
  discounts?: Discount[];
  /** Sits under the title — why these, when that is not obvious. */
  subtitle?: string;
  className?: string;
}

export default function ProductRail({
  title,
  products,
  discounts = [],
  subtitle,
  className,
}: ProductRailProps) {
  if (products.length === 0) return null;

  return (
    <section className={`mt-12 ${className ?? ''}`} aria-labelledby={`rail-${slug(title)}`}>
      <div className="mb-4">
        <h2 id={`rail-${slug(title)}`} className="text-h5 font-bold text-text-primary">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-body-sm text-text-secondary">{subtitle}</p>}
      </div>

      {/* -mx-4 px-4 lets the row bleed to the screen edge on a phone, so the
          last card is visibly cut off — which is what tells someone there is
          more to scroll to. */}
      <ul
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4"
        aria-label={title}
      >
        {products.map((product) => (
          <li key={product.id} className="w-[70%] flex-shrink-0 snap-start sm:w-auto">
            <ProductCard product={product} discounts={discounts} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
