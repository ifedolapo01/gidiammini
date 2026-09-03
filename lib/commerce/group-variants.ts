/** COMMERCE layer — shared flattened-variant grouping logic for Admin product/stock listings. */
import type { FlattenedProduct } from './product-flatten';

/** Groups flattened variants by their parent productId, preserving encounter order. */
export function groupFlattenedByProduct<T extends { productId: string }>(items: T[]): Record<string, T[]> {
  return items.reduce((acc, item) => {
    if (!acc[item.productId]) acc[item.productId] = [];
    acc[item.productId].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * True if any variant in the group varies on both axes.
 *
 * Reads the size/color fields rather than looking for a '|' in the key. Those
 * fields are real columns on product_variants now, so parsing the composite
 * key back apart — a workaround for variants living in a JSONB blob — is no
 * longer necessary. The key remains the addressing scheme; it is no longer the
 * only place the axes exist.
 */
export function hasCombination(variants: FlattenedProduct[]): boolean {
  return variants.some(v => !!v.size && !!v.color);
}

export interface SizeGroupedVariant extends FlattenedProduct {
  extractedSize: string;
  extractedColor: string;
}

/** Groups combination variants by size, surfacing size/color on each entry. */
export function groupBySize(variants: FlattenedProduct[]): Record<string, SizeGroupedVariant[]> {
  return variants.reduce((acc, v) => {
    // Falls back to splitting the key only for entries built from the legacy
    // pricing_config path, which has no separate size/color to read.
    const [keySize, keyColor] = v.variantKey.split('|');
    const size = v.size ?? keySize ?? '';
    const color = v.color ?? keyColor ?? '';
    if (!acc[size]) acc[size] = [];
    acc[size].push({ ...v, extractedSize: size, extractedColor: color });
    return acc;
  }, {} as Record<string, SizeGroupedVariant[]>);
}
