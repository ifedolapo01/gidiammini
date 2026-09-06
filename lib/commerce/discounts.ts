/** COMMERCE layer — shared discount logic. Used by Storefront and Admin. */
import { parseVariantTargets } from './discount-target';

export type DiscountType = 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';

export interface Discount {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  scope: 'SITEWIDE' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT' | 'VARIANT';
  target_id: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
  /** Uppercase redemption code. Null means the discount applies automatically
   *  to everyone, which is how every discount behaved before codes existed. */
  code?: string | null;
  /** Total uses allowed. Null is unlimited. */
  max_redemptions?: number | null;
  /** Uses per customer, matched on email. Null is unlimited. */
  per_customer_limit?: number | null;
  /** Minimum items subtotal, in whole naira. */
  min_order_value?: number | null;
  /** Maintained by a trigger on discount_redemptions. */
  redemption_count?: number | null;
}

/** True when a customer has to type something to get this. */
export function requiresCode(discount: Pick<Discount, 'code'>): boolean {
  return typeof discount.code === 'string' && discount.code.trim() !== '';
}

/** Whether a discount's schedule and switch allow it right now. */
export function isLive(discount: Discount, now: Date = new Date()): boolean {
  if (!discount.is_active) return false;
  if (discount.start_date && new Date(discount.start_date) > now) return false;
  if (discount.end_date && new Date(discount.end_date) < now) return false;
  return true;
}

/**
 * A standing free-delivery offer, if one applies to this basket.
 *
 * The codeless counterpart to a FREE_SHIPPING code. Without this an automatic
 * free-delivery discount would be a row the admin can create, the table can
 * display, and nothing would ever apply — the worst kind of feature.
 *
 * SITEWIDE only, deliberately. Delivery is charged per order, not per line, so
 * "free delivery on the Kids category" has no single honest meaning: does one
 * kids' item in a basket of ten earn it? Rather than pick an answer nobody
 * asked for, a narrower scope is ignored here and the admin form says so.
 *
 * Distinct from store_settings.free_shipping_threshold, which is the shop's
 * permanent policy. This is a campaign: time-boxed, switchable, and reportable
 * against what it cost.
 */
export function findFreeShippingDiscount(
  discounts: Discount[],
  subtotal: number,
  now: Date = new Date()
): Discount | null {
  const eligible = discounts.filter(
    (discount) =>
      discount.type === 'FREE_SHIPPING' &&
      !requiresCode(discount) &&
      discount.scope === 'SITEWIDE' &&
      isLive(discount, now) &&
      subtotal >= (discount.min_order_value ?? 0)
  );

  // The one with the highest minimum, where several apply. All of them waive
  // the same fee, so the tie-break is which offer the customer actually
  // qualified for by spending most — and that is the one to report against.
  return (
    eligible.sort((a, b) => (b.min_order_value ?? 0) - (a.min_order_value ?? 0))[0] ?? null
  );
}

/**
 * Discounts that apply on their own, to everyone.
 *
 * Two exclusions, and getting either wrong is a bug that shows up as money.
 *
 *   * A discount with a code is opt-in. Leaving it in this list would apply
 *     every influencer code to every shopper automatically, which is the
 *     opposite of what a code is for.
 *   * FREE_SHIPPING is not a line discount. It comes off the delivery fee, and
 *     its `value` is 0 by constraint — run it through getBestDiscount and it
 *     would compare as "saves nothing" at best, or subtract a meaningless
 *     number from a garment's price if that constraint were ever relaxed.
 *
 * Applied by priceOrder() before it prices a single line.
 */
export function automaticLineDiscounts(discounts: Discount[]): Discount[] {
  return discounts.filter((d) => !requiresCode(d) && d.type !== 'FREE_SHIPPING');
}

export function formatDiscountValue(
  discount: Pick<Discount, 'type' | 'value'>,
  fixedStyle: 'off' | 'save' = 'off'
): string {
  if (discount.type === 'FREE_SHIPPING') return 'FREE DELIVERY';
  if (discount.type === 'PERCENTAGE') return `${discount.value}% OFF`;
  const amount = `₦${discount.value.toLocaleString()}`;
  return fixedStyle === 'save' ? `Save ${amount}` : `${amount} OFF`;
}

export function getBestDiscount(product: any, discounts: Discount[], currentPrice?: number, selectedSize?: string, selectedColor?: string): Discount | null {
  if (!discounts || discounts.length === 0) return null;

  const now = new Date();
  
  // Filter active and valid discounts for this product
  const validDiscounts = discounts.filter(d => {
    // Check if active
    if (!d.is_active) return false;
    
    // Check dates
    if (d.start_date && new Date(d.start_date) > now) return false;
    if (d.end_date && new Date(d.end_date) < now) return false;
    
    // Check scope
    if (d.scope === 'SITEWIDE') return true;
    if (d.scope === 'CATEGORY' && d.target_id === product.category) return true;
    if (d.scope === 'SUBCATEGORY' && d.target_id === product.sub_category) return true;
    if (d.scope === 'PRODUCT' && d.target_id === product.id) return true;
    if (d.scope === 'VARIANT' && d.target_id) {
      const variantTargets = parseVariantTargets(d.target_id);

      return variantTargets.some(({ productId: targetProdId, size: targetSize, color: targetColor }) => {
        if (targetProdId !== product.id) return false;

        // Exact matching for specific variants
        // Both size and color must match if they are provided in the target
        const sizeMatches = !targetSize || targetSize === selectedSize;
        const colorMatches = !targetColor || targetColor === selectedColor;

        return sizeMatches && colorMatches;
      });
    }
    
    return false;
  });

  if (validDiscounts.length === 0) return null;

  // Find the one that gives the maximum discount value
  const baseCalculationPrice = currentPrice !== undefined ? currentPrice : product.price;

  let bestDiscount = validDiscounts[0];
  let maxSavings = calculateSavings(baseCalculationPrice, bestDiscount);

  for (let i = 1; i < validDiscounts.length; i++) {
    const savings = calculateSavings(baseCalculationPrice, validDiscounts[i]);
    if (savings > maxSavings) {
      maxSavings = savings;
      bestDiscount = validDiscounts[i];
    }
  }

  return bestDiscount;
}

export function calculateSavings(price: number, discount: Discount | null): number {
  // Free delivery takes nothing off a garment. Callers that want the waived
  // fee ask priceOrder(), which is the only thing that knows what the zone
  // charges. Placed above the null guard's sibling checks so no arithmetic
  // below ever sees a FREE_SHIPPING row.
  if (discount?.type === 'FREE_SHIPPING') return 0;
  if (!discount) return 0;
  
  if (discount.type === 'PERCENTAGE') {
    return price * (discount.value / 100);
  } else {
    // FIXED
    return Math.min(price, discount.value); // Cannot discount more than the price
  }
}

export function calculateDiscountedPrice(price: number, discount: Discount | null): number {
  if (!discount) return price;
  // Rounded to the nearest whole Naira — order_items.price/orders.total_amount
  // are integer columns, and a PERCENTAGE discount on an odd price (e.g. 15%
  // off ₦12,999) would otherwise produce a fractional amount that fails the insert.
  return Math.round(Math.max(0, price - calculateSavings(price, discount)));
}
