/**
 * COMMERCE layer — shared variant pricing logic. Used by Storefront and Admin.
 *
 * getVariantPrice and getVariantStock read the product_variants row for the
 * selection when the rows are loaded, and fall back to the old pricing_config
 * maps when they are not. Both answers must agree, because the storefront uses
 * these to decide what to show and lib/commerce/price-order.ts uses them to
 * decide what to charge and whether stock exists.
 */
import { Product } from '@/types/product';
import { findVariant, hasVariantRows, variantsOf } from './product-variants';

/**
 * The one naira formatter. Built on Intl rather than a hand-written ₦ in front
 * of toLocaleString() for three reasons: the sign and the grouping come from
 * the same locale data instead of being assembled by hand, a negative renders
 * as -₦1,000 rather than ₦-1,000, and the minor units are stated explicitly
 * so a price never silently gains or loses kobo.
 *
 * The formatter is built once at module scope. Intl.NumberFormat construction
 * is the expensive part, and an admin table calls this a few hundred times per
 * render.
 */
const NAIRA = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  // Prices in this store are whole naira. Stating both bounds stops Intl
  // applying NGN's default of two, which would render every price as ₦1,000.00.
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  // A total arriving as NaN from a bad sum should read as an obvious gap, not
  // as "₦NaN" sitting in a column of real figures.
  if (!Number.isFinite(amount)) return '—';
  return NAIRA.format(amount);
}

export function formatPriceRange(min: number, max: number): string {
  return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
}

export function getVariantPrice(
  product: Product,
  selectedSize?: string | null,
  selectedColor?: string | null
): number {
  // The relational source of truth, when it has been loaded.
  if (hasVariantRows(product)) {
    const variant = findVariant(product, selectedSize, selectedColor);
    // An incomplete selection (size chosen, colour not yet) matches nothing;
    // showing the product's base price is the existing behaviour.
    if (variant) return Number(variant.price) || 0;
    return product.price;
  }

  const config = product.pricing_config;
  
  if (!config) {
    return product.price;
  }

  if (config.mode === 'single') {
    return product.price;
  }

  if (config.mode === 'size' && selectedSize) {
    return config.sizePrices?.[selectedSize] ?? product.price;
  }

  if (config.mode === 'color' && selectedColor) {
    return config.colorPrices?.[selectedColor] ?? product.price;
  }

  if (config.mode === 'combination' && selectedSize && selectedColor) {
    const key = `${selectedSize}|${selectedColor}`;
    return config.combinationPrices?.[key] ?? product.price;
  }

  // Fallback if combination is requested but only one variant is selected
  // (e.g. they selected size but color is not selected yet)
  return product.price;
}

export function getVariantStock(
  product: Product,
  selectedSize?: string | null,
  selectedColor?: string | null
): number {
  if (hasVariantRows(product)) {
    const variant = findVariant(product, selectedSize, selectedColor);
    // No row means nothing to sell for that selection. Returning the product
    // total here — as the pricing_config path does — would advertise stock for
    // a combination that does not exist, which adjust_order_stock now refuses
    // outright. Zero is the honest answer.
    if (!variant || !variant.is_active) return 0;
    return Number(variant.stock) || 0;
  }

  const config = product.pricing_config;

  if (!config) {
    return product.stock;
  }

  if (config.mode === 'single') {
    const singleStock = (config as any).singleStock;
    return singleStock !== undefined ? singleStock : product.stock;
  }

  if (config.mode === 'size' && selectedSize) {
    return config.sizeStock?.[selectedSize] ?? product.stock;
  }

  if (config.mode === 'color' && selectedColor) {
    return config.colorStock?.[selectedColor] ?? product.stock;
  }

  if (config.mode === 'combination' && selectedSize && selectedColor) {
    const key = `${selectedSize}|${selectedColor}`;
    return config.combinationStock?.[key] ?? product.stock;
  }

  // Fallback if combination is requested but only one variant is selected
  // (e.g. they selected size but color is not selected yet)
  return product.stock;
}

export function getProductPriceRange(product: Product): { min: number; max: number } {
  // Variant rows first, for the same reason getVariantPrice prefers them: the
  // range a card advertises and the price the page charges must come from one
  // source. Reading pricing_config here while getVariantPrice read the rows was
  // how a card could show a range that no selection on the page could produce.
  if (hasVariantRows(product)) {
    const prices = variantsOf(product)
      .filter((variant) => variant.is_active)
      .map((variant) => Number(variant.price))
      .filter((price) => Number.isFinite(price));

    if (prices.length > 0) {
      return { min: Math.min(...prices), max: Math.max(...prices) };
    }
  }

  const config = product.pricing_config;
  
  if (!config || config.mode === 'single') {
    return { min: product.price, max: product.price };
  }

  let prices: number[] = [product.price];

  if (config.mode === 'size' && config.sizePrices) {
    prices = Object.values(config.sizePrices);
  } else if (config.mode === 'color' && config.colorPrices) {
    prices = Object.values(config.colorPrices);
  } else if (config.mode === 'combination' && config.combinationPrices) {
    prices = Object.values(config.combinationPrices);
  }

  // Filter out any invalid numbers
  prices = prices.filter(p => typeof p === 'number' && !isNaN(p));
  
  if (prices.length === 0) {
    return { min: product.price, max: product.price };
  }

  return {
    min: Math.min(...prices),
    max: Math.max(...prices)
  };
}
