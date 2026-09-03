/**
 * COMMERCE layer — shared variant flattening logic. Used by Storefront and Admin.
 *
 * The output shape is the read interface for variants across the whole
 * application: the admin product table, the stock page and discount targeting
 * all consume it. That is why it did not change when variants moved out of
 * products.pricing_config and into the product_variants table — this file
 * reads the rows when they are present and falls back to the old JSONB maps
 * when they are not, so both models render identically.
 *
 * The fallback is not dead code: a query that does not embed
 * `product_variants` returns products without them, and the storefront's anon
 * key cannot select every variant column. Rather than have callers guess, the
 * flattener accepts either.
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
  price: number;
  stock: number;
  main_image: string | undefined;
  images: string[] | undefined;
  colorImages?: Record<string, string>;
  /** Present only when built from a variant row. Lets the admin address the
   * exact row, and is null for anything derived from pricing_config. */
  /** The axes as data rather than a string to be parsed. Populated from the
   * variant row, or split out of the key on the pricing_config fallback. */
  size?: string | null;
  color?: string | null;
  variantId?: string | null;
  sku?: string | null;
  /** Service-role reads only; anon is not granted this column. */
  cost?: number | null;
  isActive?: boolean;
}

function buildVariantEntry(
  p: any,
  variantKey: string,
  variantLabel: string,
  price: number,
  stock: number,
  axes?: { size: string | null; color: string | null }
): FlattenedProduct {
  return {
    id: `${p.id}-${variantKey}`,
    ...axes,
    productId: p.id,
    name: p.name,
    variantKey,
    variantLabel,
    category: p.category,
    sub_category: p.sub_category,
    price,
    stock,
    main_image: p.main_image || (p.images && p.images[0]),
    images: p.images,
    colorImages: p.pricing_config?.colorImages
  };
}

function buildSingleFallback(p: any): FlattenedProduct {
  const size = p.pricing_config?.singleSize || null;
  const color = p.pricing_config?.singleColor || null;
  const label = [size, color].filter(Boolean).join(' / ') || 'Standard';
  return buildVariantEntry(p, 'single', label, p.price, p.stock, { size, color });
}

/** One flattened entry per variant row — the relational path. */
function buildFromVariantRow(p: any, variant: ProductVariant): FlattenedProduct {
  return {
    ...buildVariantEntry(p, variant.variant_key, variantLabel(variant), Number(variant.price) || 0, Number(variant.stock) || 0,
      { size: variant.size, color: variant.color }),
    // Prefer the variant's own image over the product's, so a colourway shows
    // its own photo in the admin tables.
    main_image: variant.image_url || p.main_image || (p.images && p.images[0]),
    variantId: variant.id,
    sku: variant.sku ?? null,
    cost: variant.cost ?? null,
    isActive: variant.is_active,
  };
}

export function flattenProducts(products: any[]): FlattenedProduct[] {
  const flattened: FlattenedProduct[] = [];

  products.forEach(p => {
    // The relational model wins wherever it is available.
    const variants = variantsOf(p);
    if (variants.length > 0) {
      // Stable ordering, so the admin tables do not reshuffle between loads.
      [...variants]
        .sort((a, b) => a.variant_key.localeCompare(b.variant_key))
        .forEach((variant) => flattened.push(buildFromVariantRow(p, variant)));
      return;
    }

    const mode = p.pricing_config?.mode;

    if (!p.pricing_config || mode === 'single' || !mode) {
      flattened.push(buildSingleFallback(p));
      return;
    }

    if (mode === 'combination') {
      const prices = p.pricing_config.combinationPrices || {};
      const stocks = p.pricing_config.combinationStock || {};
      const keys = Object.keys(prices);

      if (keys.length === 0) {
        flattened.push(buildSingleFallback(p));
      }

      keys.forEach(key => {
        const [size, color] = key.split('|');
        const label = `${size || ''} / ${color || ''}`.replace(/^\s\/\s|\s\/\s$/g, '');
        flattened.push(buildVariantEntry(p, key, label, prices[key] || 0, stocks[key] || 0,
          { size: size || null, color: color || null }));
      });
      return;
    }

    if (mode === 'size') {
      const prices = p.pricing_config.sizePrices || {};
      const stocks = p.pricing_config.sizeStock || {};
      const keys = Object.keys(prices);

      if (keys.length === 0) {
        flattened.push(buildSingleFallback(p));
      }

      keys.forEach(key => {
        flattened.push(buildVariantEntry(p, key, `${key}`, prices[key] || 0, stocks[key] || 0,
          { size: key, color: null }));
      });
      return;
    }

    if (mode === 'color') {
      const prices = p.pricing_config.colorPrices || {};
      const stocks = p.pricing_config.colorStock || {};
      const keys = Object.keys(prices);

      if (keys.length === 0) {
        flattened.push(buildSingleFallback(p));
      }

      keys.forEach(key => {
        flattened.push(buildVariantEntry(p, key, `${key}`, prices[key] || 0, stocks[key] || 0,
          { size: null, color: key }));
      });
    }
  });

  return flattened;
}
