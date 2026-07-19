/**
 * COMMERCE layer — pure helpers shared by the admin product create/edit forms.
 * No React; safe to unit test in isolation.
 */
import { PricingConfig } from '@/types/product';

export interface VariantColor {
  name: string;
  price: number;
  stock: number;
}

export interface VariantSize {
  size: string;
  price: number;
  stock: number;
  colors: VariantColor[];
}

/** A single product image while being composed in the admin form (before/after upload). */
export interface ImageFile {
  file: File | null;
  url: string;
  isMain: boolean;
  assignedColor?: string;
  isUploading?: boolean;
}

/** Title-cases each word of a string, e.g. "cotton tee" -> "Cotton Tee". */
export function toTitleCase(value: string): string {
  return value
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface BuildPricingConfigParams {
  hasVariants: boolean;
  hasSizes: boolean;
  hasColors: boolean;
  variants: VariantSize[];
  /** Base price/stock used only when the product has no variants. */
  singlePrice: number;
  singleStock: number;
  singleSize?: string;
  singleColor?: string;
}

export interface BuildPricingConfigResult {
  pricingConfig: PricingConfig;
  totalStock: number;
  minPrice: number;
  uniqueSizes: Set<string>;
  uniqueColors: Set<string>;
}

/**
 * Turns the admin form's variant state into the `pricing_config` shape the
 * products API expects, branching on single/size/color/combination mode.
 * Pure function — identical logic previously duplicated in both product
 * create and edit `onSubmit` handlers.
 */
export function buildPricingConfigFromVariants(params: BuildPricingConfigParams): BuildPricingConfigResult {
  const { hasVariants, hasSizes, hasColors, variants, singlePrice, singleStock, singleSize, singleColor } = params;

  let totalStock = 0;
  let minPrice = Infinity;
  const pricingConfig: PricingConfig = { mode: 'single' };
  const uniqueSizes = new Set<string>();
  const uniqueColors = new Set<string>();

  if (!hasVariants) {
    totalStock = singleStock;
    pricingConfig.singleStock = totalStock;
    if (singleSize) pricingConfig.singleSize = singleSize;
    if (singleColor) pricingConfig.singleColor = singleColor;
    if (singleSize) uniqueSizes.add(singleSize);
    if (singleColor) uniqueColors.add(singleColor);
    minPrice = singlePrice;
  } else if (hasSizes && hasColors) {
    pricingConfig.mode = 'combination';
    pricingConfig.combinationPrices = {};
    pricingConfig.combinationStock = {};

    variants.forEach((v) => {
      const s = v.size.trim();
      if (s) uniqueSizes.add(s);
      v.colors.forEach((c) => {
        const cn = c.name.trim();
        if (cn) uniqueColors.add(cn);
        if (s && cn) {
          const key = `${s}|${cn}`;
          pricingConfig.combinationPrices![key] = c.price;
          pricingConfig.combinationStock![key] = c.stock;
          totalStock += c.stock;
          if (c.price < minPrice) minPrice = c.price;
        }
      });
    });
  } else if (hasSizes && !hasColors) {
    pricingConfig.mode = 'size';
    pricingConfig.sizePrices = {};
    pricingConfig.sizeStock = {};

    variants.forEach((v) => {
      const s = v.size.trim();
      if (s) {
        uniqueSizes.add(s);
        pricingConfig.sizePrices![s] = v.price;
        pricingConfig.sizeStock![s] = v.stock;
        totalStock += v.stock;
        if (v.price < minPrice) minPrice = v.price;
      }
    });
  } else if (!hasSizes && hasColors) {
    pricingConfig.mode = 'color';
    pricingConfig.colorPrices = {};
    pricingConfig.colorStock = {};

    variants.forEach((v) => {
      v.colors.forEach((c) => {
        const cn = c.name.trim();
        if (cn) {
          uniqueColors.add(cn);
          pricingConfig.colorPrices![cn] = c.price;
          pricingConfig.colorStock![cn] = c.stock;
          totalStock += c.stock;
          if (c.price < minPrice) minPrice = c.price;
        }
      });
    });
  }

  return { pricingConfig, totalStock, minPrice, uniqueSizes, uniqueColors };
}

/**
 * Posts (create) or puts (update, when `id` is provided) a product payload
 * to the shared admin products API, throwing on any failure so callers can
 * surface the message via their own error state.
 */
export async function saveProduct(productData: Record<string, unknown>, id?: string): Promise<void> {
  const method = id ? 'PUT' : 'POST';
  const body = id ? { id, ...productData } : productData;

  const response = await fetch('/api/admin/products', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. Please check the API route.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || (id ? 'Failed to update product' : 'Failed to create product'));
  }
}
