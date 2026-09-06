/**
 * COMMERCE layer — pricing a basket's lines against a set of discounts. Pure.
 *
 * Lifted out of price-order.ts, which runs it twice: once with only the
 * discounts that apply on their own, and again with a valid redemption code
 * added to the candidates. The difference between the two totals is exactly
 * what the code was worth, which is the figure the checkout shows and the
 * figure recorded against the redemption.
 *
 * Its own module because that double pass is the subtle part of the pricing
 * story and it reads badly as a closure halfway down a longer function — and
 * because the arithmetic is testable without a Supabase client this way.
 */
import type { Product } from '@/types/product';
import { getVariantPrice, getVariantStock } from './pricing';
import { getBestDiscount, calculateDiscountedPrice, type Discount } from './discounts';
import type { PricedLine } from './price-order.types';

export interface CartLine {
  product_id: string;
  size: string | null;
  color: string | null;
  quantity: number;
}

export interface PriceLinesInput {
  lines: CartLine[];
  productsById: Map<string, Product>;
  /** Every discount allowed to compete for these lines. Each line takes
   *  whichever of them saves the customer most; they never stack. */
  candidates: Discount[];
}

export function priceCartLines({ lines, productsById, candidates }: PriceLinesInput): PricedLine[] {
  return lines.map((line) => {
    const product = productsById.get(line.product_id)!;
    const basePrice = getVariantPrice(product, line.size, line.color);
    const discount = getBestDiscount(
      product,
      candidates,
      basePrice,
      line.size ?? undefined,
      line.color ?? undefined
    );

    return {
      product_id: product.id,
      product_name: product.name,
      size: line.size,
      color: line.color,
      quantity: line.quantity,
      base_price: basePrice,
      price: calculateDiscountedPrice(basePrice, discount),
      // Recorded, not merely used: persist-order writes it to
      // order_items.discount_id, which is what makes "what did this sale earn"
      // answerable for automatic discounts and not only for codes.
      discount_id: discount?.id ?? null,
      available_stock: getVariantStock(product, line.size, line.color),
    };
  });
}

/** The items subtotal for a set of priced lines. */
export function sumOf(priced: PricedLine[]): number {
  return priced.reduce((total, line) => total + line.price * line.quantity, 0);
}
