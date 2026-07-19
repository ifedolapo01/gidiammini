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

/** True if any variant in the group is a 'size|color' combination key. */
export function hasCombination(variants: FlattenedProduct[]): boolean {
  return variants.some(v => v.variantKey.includes('|'));
}

export interface SizeGroupedVariant extends FlattenedProduct {
  extractedSize: string;
  extractedColor: string;
}

/** Groups combination variants ('size|color' variantKey) by size, extracting size/color onto each entry. */
export function groupBySize(variants: FlattenedProduct[]): Record<string, SizeGroupedVariant[]> {
  return variants.reduce((acc, v) => {
    const [size, color] = v.variantKey.split('|');
    if (!acc[size]) acc[size] = [];
    acc[size].push({ ...v, extractedSize: size, extractedColor: color });
    return acc;
  }, {} as Record<string, SizeGroupedVariant[]>);
}
