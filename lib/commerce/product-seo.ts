/**
 * COMMERCE layer — the text and URLs a product page puts in its <head>.
 *
 * Title, snippet, og:image list, the price and availability facts behind them,
 * and the escaping the sitemap needs. The schema.org graph built on top of
 * these lives in product-jsonld.ts.
 *
 * Pure by design: it takes a product, its active discounts and an absolute
 * origin, and returns strings and plain objects. No Next, no React, no
 * database — so what a shopper sees in a SERP is testable without rendering a
 * page.
 *
 * Prices go through exactly the same helpers the page renders with:
 * getProductPriceRange for the range, getBestDiscount for the reduction. A
 * snippet price that disagrees with the page is worse than no snippet price.
 */
import type { Product } from '@/types/product';
import { absoluteUrl } from '@/lib/site-url';
import { calculateDiscountedPrice, getBestDiscount, type Discount } from './discounts';
import { getProductPriceRange } from './pricing';
import { hasVariantRows, totalVariantStock } from './product-variants';

export const CURRENCY = 'NGN';
export const BRAND_NAME = 'GidiamMini';

/** Google truncates the SERP snippet around here; longer text is wasted. */
const DESCRIPTION_MAX = 160;

/**
 * One line of description text, collapsed and trimmed to a snippet length.
 *
 * Cuts on a word boundary when there is one late enough in the string to be
 * worth keeping; otherwise mid-word, because a hard cut reads better than
 * dropping half the sentence.
 */
export function truncateForMeta(text: string, max: number = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;

  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const kept = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${kept.replace(/[\s,;:.\-]+$/, '')}…`;
}

/**
 * The page's meta description. Falls back to a composed sentence rather than
 * to the site-wide default: a product with no description entered still
 * deserves a snippet naming *this* product, not one shared with every other
 * page on the store.
 */
export function productMetaDescription(
  product: Pick<Product, 'name' | 'description' | 'category'>
): string {
  const written = product.description?.trim();
  if (written) return truncateForMeta(written);

  const category = product.category?.replace(/[-_]/g, ' ').trim();
  const suffix = category ? ` Part of the ${category} range.` : '';
  return truncateForMeta(`${product.name} — available now at ${BRAND_NAME}.${suffix}`);
}

/** Whether anything at all is sellable. Variant rows win when loaded, matching
 *  getVariantStock; products.stock is the fallback for a product without them. */
export function productInStock(product: Product): boolean {
  if (hasVariantRows(product)) return totalVariantStock(product) > 0;
  return (product.stock ?? 0) > 0;
}

/** Absolute, de-duplicated image URLs, main image first. */
export function productImageUrls(
  product: Pick<Product, 'main_image' | 'images'>,
  origin?: string
): string[] {
  const candidates = [product.main_image, ...(product.images ?? [])];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim() === '') continue;
    seen.add(absoluteUrl(candidate.trim(), origin));
  }

  return [...seen];
}

/**
 * The price range a shopper would actually be charged today, discounts applied.
 *
 * Each end is discounted independently because a FIXED discount is capped at
 * the price it is applied to — ₦2,000 off caps at ₦1,500 on a ₦1,500 variant —
 * so discounting one end and scaling the other would misreport the range.
 */
export function offerPriceRange(
  product: Product,
  discounts: Discount[]
): { min: number; max: number } {
  const { min, max } = getProductPriceRange(product);
  const discounted = [min, max].map((price) =>
    calculateDiscountedPrice(price, getBestDiscount(product, discounts, price))
  );

  // Discounting can invert the ends (a FIXED cap bites harder at the bottom),
  // so sort rather than trust the input order.
  return { min: Math.min(...discounted), max: Math.max(...discounted) };
}

/**
 * A URL as it must appear inside a sitemap's <loc>.
 *
 * XML has no bare "&", and Next 16's sitemap serializer writes the URL it is
 * handed verbatim. One two-facet listing URL — "?category=babies&subcategory=
 * babies-tops" — therefore made the entire file unparseable, and a malformed
 * sitemap is rejected whole rather than entry by entry, so every product in it
 * goes undiscovered along with the bad line.
 *
 * Escaping here is the fix rather than dropping the query string, because the
 * faceted listings are exactly the pages a category search should land on. If
 * a future Next starts escaping on our behalf this turns into "&amp;amp;" —
 * which is why the test asserts the escaped form, not merely the absence of a
 * bare ampersand.
 */
export function sitemapLoc(url: string): string {
  return url
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
