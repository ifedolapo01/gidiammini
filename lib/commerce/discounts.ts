/** COMMERCE layer — shared discount logic. Used by Storefront and Admin. */
import { parseVariantTargets } from './discount-target';

export interface Discount {
  id: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  scope: 'SITEWIDE' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT' | 'VARIANT';
  target_id: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
}

export function formatDiscountValue(
  discount: Pick<Discount, 'type' | 'value'>,
  fixedStyle: 'off' | 'save' = 'off'
): string {
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
