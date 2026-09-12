/**
 * COMMERCE layer — shared variant flattening logic. Used by Storefront and Admin.
 *
 * The output shape is the read interface for variants across the whole
 * application: the admin product table, the stock page and discount targeting
 * all consume it. One flattened entry per product_variants row — the sole
 * source of truth for variant price/stock/images since pricing_config was
 * dropped.
 */
import { variantsOf, variantLabel, type ProductVariant } from './product-variants';

export interface FlattenedProduct {
  id: string; // A unique composite key (e.g., productId-variantKey)
  productId: string; // The original product ID
  name: string;
  variantKey: string; // 'single' or 'size|color' or 'size' or 'color'
  variantLabel: string; // A human-readable label like "1-2 months / Red"
  category: string;
  sub_category?: string;
  sub_sub_category?: string;
  price: number;
  stock: number;
  main_image: string | undefined;
  images: string[] | undefined;
  /** Whether this row carries its own photo, as opposed to falling back to
   *  the product's main image. */
  hasOwnImage: boolean;
  /** The axes as data rather than a string to be parsed. */
  size?: string | null;
  color?: string | null;
  variantId?: string | null;
  sku?: string | null;
  /** Service-role reads only; anon is not granted this column. */
  cost?: number | null;
  isActive?: boolean;
  /** Curated onto the home page's featured grid. Product-level, so every
   *  variant row of the same product carries the same value. */
  isFeatured?: boolean;
}

/** One flattened entry per variant row. */
function buildFromVariantRow(p: any, variant: ProductVariant): FlattenedProduct {
  return {
    id: `${p.id}-${variant.variant_key}`,
    size: variant.size,
    color: variant.color,
    productId: p.id,
    name: p.name,
    variantKey: variant.variant_key,
    variantLabel: variantLabel(variant),
    category: p.category,
    sub_category: p.sub_category,
    sub_sub_category: p.sub_sub_category,
    price: Number(variant.price) || 0,
    stock: Number(variant.stock) || 0,
    // Prefer the variant's own image over the product's, so a colourway shows
    // its own photo in the admin tables.
    main_image: variant.image_url || p.main_image || (p.images && p.images[0]),
    images: p.images,
    hasOwnImage: Boolean(variant.image_url),
    isFeatured: Boolean(p.is_featured),
    variantId: variant.id,
    sku: variant.sku ?? null,
    cost: variant.cost ?? null,
    isActive: variant.is_active,
  };
}

/**
 * How a variant is addressed across the API boundary: "productId:variantKey".
 *
 * FlattenedProduct.id uses a hyphen, which is also legal inside a uuid and
 * inside a variant key, so it cannot be split back apart. This form can:
 * the first colon is the separator, and everything after it is the key
 * (which may itself contain "size|color").
 */
export function variantRef(product: Pick<FlattenedProduct, 'productId' | 'variantKey'>): string {
  return `${product.productId}:${product.variantKey}`;
}

export function flattenProducts(products: any[]): FlattenedProduct[] {
  const flattened: FlattenedProduct[] = [];

  products.forEach(p => {
    // Stable ordering, so the admin tables do not reshuffle between loads.
    [...variantsOf(p)]
      .sort((a, b) => a.variant_key.localeCompare(b.variant_key))
      .forEach((variant) => flattened.push(buildFromVariantRow(p, variant)));
  });

  return flattened;
}
