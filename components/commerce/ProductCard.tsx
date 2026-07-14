/** COMMERCE layer — shared product card. Used by Storefront (and available to Admin). No branding — renders via tokens. */
import Link from 'next/link';
import { ProductCardProduct } from '@/types/product';
import { Discount, getBestDiscount, calculateDiscountedPrice, formatDiscountValue } from '@/lib/commerce/discounts';
import { getProductPriceRange, formatPriceRange } from '@/lib/commerce/pricing';
import { Badge } from '@/components/ui';
import { StockBadge } from './StockBadge';

interface ProductCardProps {
  product: ProductCardProduct;
  discounts?: Discount[];
}

export default function ProductCard({ product, discounts = [] }: ProductCardProps) {
  // Use defaults for missing fields
  const isOutOfStock = (product.stock || 0) <= 0;
  // Use a fallback image without onError handler
  const imageUrl = product.main_image || product.image || '/placeholder.jpg';
  const description = product.description || '';
  const category = product.category || '';
  const stock = product.stock || 0;

  const bestDiscount = getBestDiscount(product, discounts);

  // Get price range
  const { min, max } = getProductPriceRange(product as any);

  const finalMinPrice = calculateDiscountedPrice(min, bestDiscount);
  const finalMaxPrice = calculateDiscountedPrice(max, bestDiscount);

  return (
    <Link href={`/products/${product.id}`} className="group">
      <div className="bg-surface rounded-surface shadow-elevation-2 overflow-hidden transition-transform duration-300 hover:scale-[1.02] hover:shadow-elevation-4 relative">

        <StockBadge
          stock={stock}
          labels={{ out: 'SOLD OUT', low: 'LOW STOCK' }}
          countFormat="colon"
          className="absolute top-2 left-2 z-10"
        />

        <div className="relative w-full overflow-hidden">
          {/* Remove onError handler for server component */}
          <img
            src={imageUrl}
            alt={product.name}
            className={`w-full aspect-[4/3] object-cover block group-hover:scale-110 transition-transform duration-500 ${
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
