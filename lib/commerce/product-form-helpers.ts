/**
 * COMMERCE layer — pure helpers shared by the admin product create/edit forms.
 * No React; safe to unit test in isolation.
 */

export interface VariantColor {
  name: string;
  price: number;
  stock: number;
  /** What this unit costs the store. Optional: null means "not recorded",
   * which is deliberately different from 0 — zero cost would report the whole
   * sale price as profit. */
  cost?: number | null;
}

export interface VariantSize {
  size: string;
  price: number;
  stock: number;
  cost?: number | null;
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

/** One product_variants row as the write path (replace_product_variants) expects it. */
export interface VariantRowInput {
  size: string | null;
  color: string | null;
  price: number;
  stock: number;
  cost?: number | null;
}

export interface BuildVariantRowsParams {
  hasVariants: boolean;
  hasSizes: boolean;
  hasColors: boolean;
  variants: VariantSize[];
  /** Base price/stock used only when the product has no variants. */
  singlePrice: number;
  singleStock: number;
  singleSize?: string;
  singleColor?: string;
  /** Cost for a product with no variants. */
  singleCost?: number | null;
}

export interface BuildVariantRowsResult {
  variants: VariantRowInput[];
  totalStock: number;
  minPrice: number;
  uniqueSizes: Set<string>;
  uniqueColors: Set<string>;
}

/**
 * Turns the admin form's variant state into the flat row array
 * replace_product_variants() expects, branching on single/size/color/
 * combination mode. Pure function — identical logic previously duplicated in
 * both product create and edit `onSubmit` handlers.
 */
export function buildVariantRowsFromForm(params: BuildVariantRowsParams): BuildVariantRowsResult {
  const { hasVariants, hasSizes, hasColors, variants, singlePrice, singleStock, singleSize, singleColor, singleCost } = params;

  let totalStock = 0;
  let minPrice = Infinity;
  const rows: VariantRowInput[] = [];
  const uniqueSizes = new Set<string>();
  const uniqueColors = new Set<string>();

  if (!hasVariants) {
    totalStock = singleStock;
    if (singleSize) uniqueSizes.add(singleSize);
    if (singleColor) uniqueColors.add(singleColor);
    minPrice = singlePrice;
    rows.push({
      size: singleSize || null,
      color: singleColor || null,
      price: singlePrice,
      stock: singleStock,
      cost: singleCost ?? null,
    });
  } else if (hasSizes && hasColors) {
    variants.forEach((v) => {
      const s = v.size.trim();
      if (s) uniqueSizes.add(s);
      v.colors.forEach((c) => {
        const cn = c.name.trim();
        if (cn) uniqueColors.add(cn);
        if (s && cn) {
          rows.push({ size: s, color: cn, price: c.price, stock: c.stock, cost: c.cost ?? null });
          totalStock += c.stock;
          if (c.price < minPrice) minPrice = c.price;
        }
      });
    });
  } else if (hasSizes && !hasColors) {
    variants.forEach((v) => {
      const s = v.size.trim();
      if (s) {
        uniqueSizes.add(s);
        rows.push({ size: s, color: null, price: v.price, stock: v.stock, cost: v.cost ?? null });
        totalStock += v.stock;
        if (v.price < minPrice) minPrice = v.price;
      }
    });
  } else if (!hasSizes && hasColors) {
    variants.forEach((v) => {
      v.colors.forEach((c) => {
        const cn = c.name.trim();
        if (cn) {
          uniqueColors.add(cn);
          rows.push({ size: null, color: cn, price: c.price, stock: c.stock, cost: c.cost ?? null });
          totalStock += c.stock;
          if (c.price < minPrice) minPrice = c.price;
        }
      });
    });
  }

  return { variants: rows, totalStock, minPrice, uniqueSizes, uniqueColors };
}

/**
 * Posts (create) or puts (update, when `id` is provided) a product payload
 * to the shared admin products API, throwing on any failure so callers can
 * surface the message via their own error state.
 *
 * Takes its fetch implementation as an argument rather than importing
 * adminFetch directly: this is COMMERCE layer, and adminFetch lives in the
 * ADMIN layer — importing it here would invert that dependency. The one
 * caller (useProductSubmit) passes adminFetch, so a 401 still reaches the
 * admin section's session-expiry handling instead of surfacing as a bare
 * "Unauthorized" banner with nobody logged out.
 */
export async function saveProduct(
  productData: Record<string, unknown>,
  id?: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const method = id ? 'PUT' : 'POST';
  const body = id ? { id, ...productData } : productData;

  const response = await fetchImpl('/api/admin/products', {
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
