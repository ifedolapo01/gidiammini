/** COMMERCE layer — shared product card. Used by Storefront (and available to Admin). No branding — renders via tokens. */
import Link from 'next/link';
import { ProductCardProduct } from '@/types/product';
import { Discount, getBestDiscount, calculateDiscountedPrice, formatDiscountValue } from '@/lib/commerce/discounts';
import { getProductPriceRange, formatPriceRange } from '@/lib/commerce/pricing';
import { Badge } from '@/components/ui';
import { StockBadge } from './StockBadge';
import ProductImage from './ProductImage';
import StarRating from './StarRating';

interface ProductCardProps {
  product: ProductCardProduct;
  discounts?: Discount[];
  /**
   * Set on the handful of cards that are on screen when the page loads, so
   * their images are fetched immediately instead of waiting for the lazy
   * observer. The grid decides which — see ProductsGrid.
   */
  priority?: boolean;
}

export default function ProductCard({ product, discounts = [], priority = false }: ProductCardProps) {
  // Use defaults for missing fields
  const isOutOfStock = (product.stock || 0) <= 0;
  // '/placeholder.jpg' used to be named here and has never existed in public/;
  // ProductImage resolves an absent URL to the placeholder that does.
  const imageUrl = product.main_image || product.image;
  const description = product.description || '';
  const category = product.category || '';
  const stock = product.stock || 0;

  const bestDiscount = getBestDiscount(product, discounts);

  // Price range. The listing precomputes this in SQL from the variants table
  // and sends price_min/price_max, so the card no longer needs the whole
  // pricing_config to derive two numbers. Anything still passing a full product
  // row — the homepage, the wishlist — falls through to the old derivation.
  const { min, max } =
    typeof product.price_min === 'number' && typeof product.price_max === 'number'
      ? { min: product.price_min, max: product.price_max }
      : getProductPriceRange(product as any);

  const finalMinPrice = calculateDiscountedPrice(min, bestDiscount);
  const finalMaxPrice = calculateDiscountedPrice(max, bestDiscount);

  return (
    <Link href={`/products/${product.id}`} className="group">
      {/* Sold-out cards are dimmed rather than hidden: the listing keeps them so
          the page keeps its ranking and the shopper can ask to be told when it
          returns. Dimming is a supporting cue only — the SOLD OUT badge carries
          the meaning, because opacity alone is not something everyone can
          perceive and it survives no screen reader. */}
      <div
        className={`bg-surface rounded-surface shadow-elevation-2 overflow-hidden transition-transform duration-300 hover:scale-[1.02] hover:shadow-elevation-4 relative ${
          isOutOfStock ? 'opacity-75 hover:opacity-100' : ''
        }`}
      >

        <StockBadge
          stock={stock}
          labels={{ out: 'SOLD OUT', low: 'LOW STOCK' }}
          countFormat="colon"
          className="absolute top-2 left-2 z-10"
        />

        <div className="relative w-full overflow-hidden">
          <ProductImage
            src={imageUrl}
            alt={product.name}
            priority={priority}
            className="w-full aspect-[4/3]"
            // The grid is one column on phones, two from sm and three from lg,
            // inside a container that stops growing at 1280px. So: the full
            // viewport width, then half, then a third of that cap.
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
            imageClassName={`group-hover:scale-110 transition-transform duration-500 ${
              isOutOfStock ? 'opacity-70' : ''
            }`}
          />
          {bestDiscount && (
            <Badge tone="destructive" variant="solid" className="absolute top-2 right-2 z-10 animate-pulse">
              {formatDiscountValue(bestDiscount)}
            </Badge>
          )}
          <div className="absolute bottom-2 right-2 bg-surface/90 backdrop-blur-sm px-3 py-1.5 rounded-control text-body-sm font-bold text-text-primary shadow-elevation-1 flex items-center gap-2">
            {bestDiscount ? (
              <div className="flex flex-col items-end">
                <span className="text-text-muted line-through text-caption-sm leading-tight">
                  {formatPriceRange(min, max)}
                </span>
                <span className="text-destructive leading-tight">
                  {formatPriceRange(finalMinPrice, finalMaxPrice)}
                </span>
              </div>
            ) : (
              <span>
                {formatPriceRange(min, max)}
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-body-lg mb-1 text-text-primary">{product.name}</h3>
          {/* Under the name, above the description: the shopper is deciding
              whether to open this card at all, and "somebody else already
              bought this and liked it" is the fastest thing on it to read.
              Rendered only when there are reviews — see rating_average. */}
          {typeof product.rating_average === 'number' && (product.review_count ?? 0) > 0 && (
            <StarRating
              average={product.rating_average}
              count={product.review_count}
              size="sm"
              className="mb-1.5"
            />
          )}
          <p className="text-text-secondary text-body-sm mb-3 line-clamp-2">
            {description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-body-sm text-text-secondary capitalize">
              {category.toLowerCase() === 'kids' ? 'Kids & Pre-teens' : category}
            </span>
            <span className="text-body-sm font-medium text-primary">
              View Details →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
