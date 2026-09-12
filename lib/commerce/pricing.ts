/**
 * COMMERCE layer — shared variant pricing logic. Used by Storefront and Admin.
 *
 * getVariantPrice and getVariantStock read the product_variants row for the
 * selection — the sole source of truth for both, since pricing_config was
 * dropped. The storefront uses these to decide what to show and
 * lib/commerce/price-order.ts uses them to decide what to charge and whether
 * stock exists.
 */
import { Product } from '@/types/product';
import { findVariant, variantsOf } from './product-variants';
import { fromMinorUnits } from './money';

/**
 * Every price this function is handed is minor units (kobo, cents — see
 * lib/commerce/money.ts), so the formatter is built per currency rather than
 * once at module scope: a fixed NGN instance could not also format a USD
 * amount once this store prices in more than one currency. Cached per code,
 * because Intl.NumberFormat construction is the expensive part and an admin
 * table calls this a few hundred times per render, almost always in the one
 * currency the store actually charges in today.
 *
 * NGN keeps zero fraction digits (this store's prices have always read as
 * ₦1,000, not ₦1,000.00); every other currency gets Intl's own default so a
 * sub-unit price — the whole reason minor units exist — is actually visible.
 */
const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  const existing = formatters.get(currency);
  if (existing) return existing;

  const formatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    ...(currency === 'NGN' ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  });
  formatters.set(currency, formatter);
  return formatter;
}

export function formatCurrency(amountMinor: number, currency: string = 'NGN'): string {
  // A total arriving as NaN from a bad sum should read as an obvious gap, not
  // as "₦NaN" sitting in a column of real figures.
  if (!Number.isFinite(amountMinor)) return '—';
  return formatterFor(currency).format(fromMinorUnits(amountMinor));
}

export function formatPriceRange(min: number, max: number, currency: string = 'NGN'): string {
  return min === max
    ? formatCurrency(min, currency)
    : `${formatCurrency(min, currency)} - ${formatCurrency(max, currency)}`;
}

export function getVariantPrice(
  product: Product,
  selectedSize?: string | null,
  selectedColor?: string | null
): number {
  const variant = findVariant(product, selectedSize, selectedColor);
  // An incomplete selection (size chosen, colour not yet), or no row at all,
  // matches nothing; showing the product's base price is the existing
  // behaviour.
  if (variant) return Number(variant.price) || 0;
  return product.price;
}

export function getVariantStock(
  product: Product,
  selectedSize?: string | null,
  selectedColor?: string | null
): number {
  const variant = findVariant(product, selectedSize, selectedColor);
  // No row means nothing to sell for that selection. Returning the product
  // total here would advertise stock for a combination that does not exist,
  // which adjust_order_stock refuses outright. Zero is the honest answer.
  if (!variant || !variant.is_active) return 0;
  return Number(variant.stock) || 0;
}

export function getProductPriceRange(product: Product): { min: number; max: number } {
  const prices = variantsOf(product)
    .filter((variant) => variant.is_active)
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price));

  if (prices.length > 0) {
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }

  return { min: product.price, max: product.price };
}
