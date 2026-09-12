/**
 * COMMERCE layer — turning parsed import rows into the body the products API
 * already accepts.
 *
 * Goes through buildPricingConfigFromVariants rather than assembling the JSONB
 * by hand: that function is what the admin form uses, and a second
 * implementation of the same mapping is how the two drift into disagreeing
 * about what a "size" product looks like.
 */
import type { PricingConfig } from '@/types/product';
import { buildPricingConfigFromVariants, type VariantSize } from './product-form-helpers';
import type { ImportProduct } from './product-import';
import { toMinorUnits } from './money';

export interface ProductWritePayload {
  name: string;
  category: string;
  sub_category: string | null;
  sub_sub_category: string | null;
  description: string;
  main_image: string;
  price: number;
  stock: number;
  sizes: string[];
  colors: string[];
  pricing_config: PricingConfig;
  /** Keyed by variant key, for applyVariantCosts. */
  variant_costs: Record<string, number>;
}

/**
 * The body the products API already accepts.
 *
 * Goes through buildPricingConfigFromVariants rather than assembling the JSONB
 * by hand: that function is what the admin form uses, and a second
 * implementation of the same mapping is how the two drift into disagreeing
 * about what a "size" product looks like.
 */
export function toProductPayload(product: ImportProduct): ProductWritePayload {
  const hasSizes = product.variants.some((v) => v.size !== '');
  const hasColors = product.variants.some((v) => v.color !== '');
  // Multiple options means multiple rows to choose between — a single row
  // that happens to name its one size/colour (e.g. "One Size" / "Multi")
  // is still a single-variant product, same as the manual admin form lets
  // you record a size/colour without ticking "Product has multiple options".
  const hasVariants = product.variants.length > 1;

  // The CSV is Naira throughout — parsed, previewed and validated that way
  // (see product-import.ts) — and converts to minor units right here, at the
  // boundary where a row becomes part of the write payload. Same boundary
  // useProductSubmit.ts applies for the manual form.
  const variants = product.variants.map((v) => ({
    ...v,
    price: toMinorUnits(v.price),
    cost: v.cost === null ? null : toMinorUnits(v.cost),
  }));

  const bySize = new Map<string, VariantSize>();

  for (const variant of variants) {
    const size = variant.size;
    let entry = bySize.get(size);

    if (!entry) {
      entry = { size, price: variant.price, stock: variant.stock, cost: variant.cost, colors: [] };
      bySize.set(size, entry);
    }

    if (variant.color) {
      entry.colors.push({
        name: variant.color,
        price: variant.price,
        stock: variant.stock,
        cost: variant.cost,
      });
    } else {
      entry.price = variant.price;
      entry.stock = variant.stock;
      entry.cost = variant.cost;
    }
  }

  const first = variants[0];

  const { pricingConfig, totalStock, minPrice, uniqueSizes, uniqueColors } =
    buildPricingConfigFromVariants({
      hasVariants,
      hasSizes,
      hasColors,
      variants: [...bySize.values()],
      singlePrice: first.price,
      singleStock: first.stock,
      singleSize: hasSizes ? first.size : undefined,
      singleColor: hasColors ? first.color : undefined,
      singleCost: first.cost,
    });

  const variantCosts: Record<string, number> = {};
  for (const variant of variants) {
    if (variant.cost === null) continue;
    const key = [variant.size, variant.color].filter(Boolean).join('|') || 'single';
    variantCosts[key] = variant.cost;
  }

  return {
    name: product.name,
    category: product.category,
    sub_category: product.subCategory,
    sub_sub_category: product.subSubCategory,
    description: product.description,
    main_image: product.mainImage,
    price: Number.isFinite(minPrice) ? minPrice : first.price,
    stock: totalStock,
    sizes: [...uniqueSizes],
    colors: [...uniqueColors],
    pricing_config: pricingConfig,
    variant_costs: variantCosts,
  };
}
