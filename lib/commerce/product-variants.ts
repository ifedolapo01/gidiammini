/**
 * COMMERCE layer — the product_variants table as the application sees it.
 *
 * Variants used to live inside products.pricing_config as parallel JSONB maps
 * keyed by a "size|color" string. They are now rows. This module is the single
 * place that knows how to address one, so the rest of the codebase keeps
 * speaking the same `variantKey` it always did.
 *
 * Two things here are load-bearing:
 *
 *   1. `PUBLIC_VARIANT_COLUMNS`. The storefront reads with the anon key, which
 *      has a column-level GRANT that excludes `cost` and `barcode`. Selecting
 *      `product_variants(*)` therefore FAILS for anon — expanding `*` touches
 *      cost. Anon-key queries must name columns; that list is here.
 *   2. `variantKeyFor`. It must produce exactly what the generated column in
 *      the database produces, or a lookup silently finds nothing.
 */

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  variant_key: string;
  price: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  /** Admin/service-role reads only — never granted to anon. */
  sku?: string | null;
  barcode?: string | null;
  cost?: number | null;
}

/** What the anon key is allowed to see. Mirrors the GRANT in
 * 20251101002600_product_variants.sql — keep the two in step. */
export const PUBLIC_VARIANT_COLUMNS = [
  'id',
  'product_id',
  'size',
  'color',
  'variant_key',
  'price',
  'stock',
  'image_url',
  'is_active',
] as const;

/**
 * Embed clause for a storefront (anon-key) product query.
 *
 * Spelled out as a literal rather than built from the array above, because the
 * typed Supabase client parses this string at the *type* level to work out the
 * shape of the result. A template literal or a `.join()` widens it to `string`,
 * and the parser then fails with "Expected identifier". A test asserts this
 * literal and PUBLIC_VARIANT_COLUMNS stay in agreement.
 */
export const PUBLIC_VARIANTS_SELECT =
  'product_variants(id,product_id,size,color,variant_key,price,stock,image_url,is_active)';

/** Embed clause for an admin (service-role) product query, cost included. */
export const ADMIN_VARIANTS_SELECT = 'product_variants(*)';

/**
 * The key a variant is addressed by. Must match the database's generated
 * column exactly:
 *
 *   COALESCE(NULLIF(concat_ws('|', size, color), ''), 'single')
 *
 * concat_ws skips NULLs, which is what makes a one-axis product key on its
 * size or its colour alone rather than on "S|" or "|red".
 */
export function variantKeyFor(size?: string | null, color?: string | null): string {
  const parts = [size, color]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join('|') : 'single';
}

/** A human-readable label: "1-2 months / red", or "Standard" for a lone variant. */
export function variantLabel(variant: Pick<ProductVariant, 'size' | 'color'>): string {
  const parts = [variant.size, variant.color].filter((part): part is string => !!part && part.trim() !== '');
  return parts.length > 0 ? parts.join(' / ') : 'Standard';
}

interface ProductWithVariants {
  product_variants?: ProductVariant[] | null;
}

/** Every variant row attached to this product, or an empty list. Tolerates the
 * embed being absent, which is what a query that didn't ask for it returns. */
export function variantsOf(product: ProductWithVariants | null | undefined): ProductVariant[] {
  const variants = product?.product_variants;
  return Array.isArray(variants) ? variants : [];
}

/** True when this product's variants were loaded — as opposed to loaded and
 * empty, or never requested. Callers use it to decide whether the relational
 * data is available or they must fall back to pricing_config. */
export function hasVariantRows(product: ProductWithVariants | null | undefined): boolean {
  return variantsOf(product).length > 0;
}

/**
 * The variant matching this selection, by the same key the database uses.
 *
 * The lone-variant fallback exists for a real mismatch. The old JSONB model
 * addressed a `single`-mode product as 'single' even when it recorded a size
 * and a colour; as a row, that variant keys on 'S|Multicolour' instead. So the
 * two spellings have to resolve to each other, in both directions:
 *
 *   - the product page reads stock before anything is selected, which asks for
 *     'single' and would otherwise miss the row and report out of stock;
 *   - a product whose row genuinely has no axes is asked for by a page that
 *     does offer a size, which would miss in the other direction.
 *
 * It is deliberately narrow. One explicit selection is never substituted for a
 * different explicit selection — with several variants, a selection matching
 * none returns null, because "you cannot buy that combination" is the truth
 * and adjust_order_stock would refuse it anyway.
 */
export function findVariant(
  product: ProductWithVariants | null | undefined,
  size?: string | null,
  color?: string | null
): ProductVariant | null {
  const variants = variantsOf(product);
  const key = variantKeyFor(size, color);

  const exact = variants.find((variant) => variant.variant_key === key);
  if (exact) return exact;

  if (variants.length === 1 && (key === 'single' || variants[0].variant_key === 'single')) {
    return variants[0];
  }

  return null;
}

/** Total sellable units across a product's active variants. Equals the value
 * the database keeps in products.stock, and is here for callers that already
 * hold the variant rows and would rather not re-read the product. */
export function totalVariantStock(product: ProductWithVariants | null | undefined): number {
  return variantsOf(product)
    .filter((variant) => variant.is_active)
    .reduce((total, variant) => total + (Number(variant.stock) || 0), 0);
}

/** The distinct sizes and colours a product is actually sellable in — the
 * facets a JSONB blob could not be indexed for. */
export function variantFacets(product: ProductWithVariants | null | undefined): {
  sizes: string[];
  colors: string[];
} {
  const sizes = new Set<string>();
  const colors = new Set<string>();

  for (const variant of variantsOf(product)) {
    if (!variant.is_active) continue;
    if (variant.size) sizes.add(variant.size);
    if (variant.color) colors.add(variant.color);
  }

  return { sizes: [...sizes], colors: [...colors] };
}
