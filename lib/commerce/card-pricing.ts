/**
 * COMMERCE layer — the price a product card shows.
 *
 * Extracted from ProductCard so the compact suggestions in the cart drawer
 * price a product exactly as the full cards do. Two implementations of "which
 * range, and what does the discount do to it" is how a product comes to be
 * advertised at one price in a rail and another on a card.
 */
import type { ProductCardProduct } from '@/types/product';
import { getBestDiscount, calculateDiscountedPrice, type Discount } from './discounts';
import { getProductPriceRange } from './pricing';

export interface CardPricing {
  /** Catalogue range, before any discount. */
  min: number;
  max: number;
  /** The same range with the best applicable discount applied. */
  finalMin: number;
  finalMax: number;
  /** The discount that produced it, for the badge and the struck-through price. */
  discount: Discount | null;
}

export function getCardPricing(
  product: ProductCardProduct,
  discounts: Discount[] = []
): CardPricing {
  const discount = getBestDiscount(product, discounts);

  // The listing precomputes the range in SQL from the variants table and sends
  // price_min/price_max, so a card there needs no pricing_config to derive two
  // numbers. Anything still passing a full product row — the homepage, the
  // wishlist, the recommendation rails — falls through to the old derivation.
  const { min, max } =
    typeof product.price_min === 'number' && typeof product.price_max === 'number'
      ? { min: product.price_min, max: product.price_max }
      : getProductPriceRange(product as never);

  return {
    min,
    max,
    finalMin: calculateDiscountedPrice(min, discount),
    finalMax: calculateDiscountedPrice(max, discount),
    discount,
  };
}
