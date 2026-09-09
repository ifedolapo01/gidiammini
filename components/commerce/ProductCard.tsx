/** COMMERCE layer — shared product card. Used by Storefront (and available to Admin). No branding — renders via tokens. */
'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { ProductCardProduct } from '@/types/product';
import { Discount, formatDiscountValue } from '@/lib/commerce/discounts';
import { formatPriceRange } from '@/lib/commerce/pricing';
import { getCardPricing } from '@/lib/commerce/card-pricing';
import { useWishlist } from '@/components/WishlistProvider';
import { Badge } from '@/components/ui';
import { StockBadge } from './StockBadge';
import ProductImage from './ProductImage';
import ColorSwatch from './ColorSwatch';
import StarRating from './StarRating';
import CategoryLabel from './CategoryLabel';

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

/** How many dots the card draws before folding the rest into "+N". Five is the
 *  most that fits a card's width without wrapping onto a second line. */
const MAX_VISIBLE_SWATCHES = 5;

export default function ProductCard({ product, discounts = [], priority = false }: ProductCardProps) {
  const { isInWishlist, toggleWishlist } = useWishlist();

  // Use defaults for missing fields
  const isOutOfStock = (product.stock || 0) <= 0;
  // '/placeholder.jpg' used to be named here and has never existed in public/;
  // ProductImage resolves an absent URL to the placeholder that does.
  const imageUrl = product.main_image || product.image;
  // main_image is stored apart from images (see useProductImages), so this is
  // never the same photo shown twice — it's the first shot the admin didn't
  // pick as the cover, which on a real product is usually a different angle
  // or colourway.
  const hoverImageUrl = product.images?.[0];
  const description = product.description || '';
  const category = product.category || '';
  const stock = product.stock || 0;
  const colors = product.colors ?? [];
  const isWishlisted = isInWishlist(product.id);

  // Shared with the cart drawer's compact suggestions, so the same product
  // cannot be advertised at two prices on two surfaces.
  const {
    min,
    max,
    finalMin: finalMinPrice,
    finalMax: finalMaxPrice,
    discount: bestDiscount,
  } = getCardPricing(product, discounts);

  return (
    <div
      className={`bg-surface rounded-surface shadow-elevation-2 overflow-hidden transition-transform duration-300 hover:scale-[1.02] hover:shadow-elevation-4 relative group ${
        isOutOfStock ? 'opacity-75 hover:opacity-100' : ''
      }`}
    >
      {/*
        A sibling of the link, not a child of it — nested interactive elements
        inside an <a> are invalid HTML, and a heart that can only be reached
        through a page it never used to require would have cost every save a
        click-through. Not disabled when out of stock: the whole point of
        wishlisting a sold-out product is asking to be told when it returns.
      */}
      <button
        type="button"
        onClick={() => toggleWishlist(product.id)}
        aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        className="absolute top-2 right-2 z-20 rounded-full bg-surface/90 p-2 shadow-elevation-1 backdrop-blur-sm hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-destructive text-destructive' : 'text-text-secondary'}`} />
      </button>

      <Link href={`/products/${product.id}`} className="block">
        {/* Sold-out cards are dimmed rather than hidden: the listing keeps them so
            the page keeps its ranking and the shopper can ask to be told when it
            returns. Dimming is a supporting cue only — the SOLD OUT badge carries
            the meaning, because opacity alone is not something everyone can
            perceive and it survives no screen reader. */}
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
          {hoverImageUrl && (
            <ProductImage
              src={hoverImageUrl}
              alt=""
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
              className="absolute inset-0 w-full aspect-[4/3] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          )}
          {bestDiscount && (
            <Badge tone="destructive" variant="solid" className="absolute top-12 right-2 z-10 animate-pulse">
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
          {colors.length > 1 && (
            <div className="flex items-center gap-1 mb-1.5">
              {/* Each dot is decorative on its own (see ColorSwatch); the fact
                  that matters to a screen reader is the count and the names,
                  said once here instead of once per dot. */}
              <span className="sr-only">Available in {colors.join(', ')}</span>
              {colors.slice(0, MAX_VISIBLE_SWATCHES).map((color) => (
                <ColorSwatch key={color} value={color} />
              ))}
              {colors.length > MAX_VISIBLE_SWATCHES && (
                <span className="text-caption-sm text-text-muted" aria-hidden="true">
                  +{colors.length - MAX_VISIBLE_SWATCHES}
                </span>
              )}
            </div>
          )}
          <p className="text-text-secondary text-body-sm mb-3 line-clamp-2">
            {description}
          </p>
          <div className="flex items-center justify-between">
            {/* The category's own label, from the table. This used to be a
                hardcoded 'kids' -> 'Kids & Pre-teens' special case, which no
                category added since could ever benefit from. `capitalize`
                still covers the fallback to a bare slug. */}
            <span className="text-body-sm text-text-secondary capitalize">
              <CategoryLabel slug={category} />
            </span>
            <span className="text-body-sm font-medium text-primary">
              View Details →
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
