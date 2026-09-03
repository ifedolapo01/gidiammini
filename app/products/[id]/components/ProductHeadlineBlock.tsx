/**
 * STOREFRONT layer — the product's headline: name, rating, description, stock, price.
 *
 * Extracted from ProductDetailView when the star line was added, because that
 * file had already passed the 200-line mark and this is the one cohesive
 * chunk in it: everything a shopper reads before they start choosing a size.
 * The pieces below it — variant selector, quantity, add to cart — are
 * interaction, and they stay with the state that drives them.
 *
 * No state of its own. It is handed the numbers the view has already worked
 * out, so it stays a rendering component and the pricing logic keeps one home.
 */
import StarRating from '@/components/commerce/StarRating';
import type { Discount } from '@/lib/commerce/discounts';
import type { ReviewStats } from '@/lib/commerce/rating-math';
import type { Product } from '@/types/product';
import ProductPriceDisplay from './ProductPriceDisplay';
import StockStatusPanel from './StockStatusPanel';

interface ProductHeadlineBlockProps {
  product: Product;
  currentBasePrice: number;
  currentStock: number;
  finalPrice: number;
  bestDiscount: Discount | null;
  reviewStats: ReviewStats;
}

export default function ProductHeadlineBlock({
  product,
  currentBasePrice,
  currentStock,
  finalPrice,
  bestDiscount,
  reviewStats,
}: ProductHeadlineBlockProps) {
  return (
    <div className="mb-4 md:mb-6">
      <h1 className="text-h4 md:text-h3 font-bold mb-2 md:mb-4 text-text-primary">
        {product.name}
      </h1>

      {/* The stars sit with the name and the price, where the decision is being
          made — not only at the bottom of the page where the reviews
          themselves are. The link is what connects the two, and it is an
          anchor rather than a scroll handler so it works before hydration and
          can be opened in a new tab. */}
      {reviewStats.review_count > 0 && (
        <a
          href="#reviews"
          className="mb-3 inline-flex items-center gap-2 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <StarRating average={reviewStats.rating_average} size="md" showValue />
          <span className="text-body-sm text-text-secondary underline-offset-4 hover:underline">
            {reviewStats.review_count} {reviewStats.review_count === 1 ? 'review' : 'reviews'}
          </span>
        </a>
      )}

      <p className="text-text-secondary text-body-md md:text-body-lg mb-4 md:mb-6">
        {product.description}
      </p>

      <StockStatusPanel stock={currentStock} />

      <ProductPriceDisplay
        bestDiscount={bestDiscount}
        finalPrice={finalPrice}
        currentBasePrice={currentBasePrice}
      />
    </div>
  );
}
