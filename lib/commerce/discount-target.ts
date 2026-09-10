/** COMMERCE layer — shared discount variant-target serialization. Used by Storefront and Admin. */
import type { Category, Product } from '@/types/product';
import type { Discount } from './discounts';

export interface VariantTarget {
  productId: string;
  size: string;
  color: string;
}

/** Serializes variant targets into the `target_id` wire format: "productId:size:color,productId:size:color". */
export function serializeVariantTargets(variants: VariantTarget[]): string {
  return variants.map(v => `${v.productId}:${v.size}:${v.color}`).join(',');
}

/** Parses a VARIANT discount's `target_id` back into individual variant targets. Returns [] for empty input. */
export function parseVariantTargets(target_id: string | null | undefined): VariantTarget[] {
  if (!target_id) return [];
  return target_id.split(',').map(v => {
    const parts = v.split(':');
    return { productId: parts[0] || '', size: parts[1] || '', color: parts[2] || '' };
  });
}

/** Resolves a discount's `target_id` to a human-readable label based on its scope. */
export function formatTarget(
  discount: Pick<Discount, 'scope' | 'target_id'>,
  categories: Category[],
  products: Pick<Product, 'id' | 'name'>[]
): string {
  if (!discount.target_id) return '';

  if (discount.scope === 'CATEGORY') {
    // Keyed by slug, matching what DiscountTargetField actually writes into
    // target_id for this scope — comparing against `id` here never matched it.
    const cat = categories.find(c => c.slug === discount.target_id);
    return cat ? cat.name : discount.target_id;
  }

  if (discount.scope === 'SUBCATEGORY') {
    for (const cat of categories) {
      const sub = cat.subcategories?.find(s => s.slug === discount.target_id);
      if (sub) return `${cat.name} > ${sub.name}`;
    }
    return discount.target_id;
  }

  if (discount.scope === 'SUBSUBCATEGORY') {
    for (const cat of categories) {
      for (const sub of cat.subcategories ?? []) {
        const subSub = sub.subsubcategories?.find(s => s.slug === discount.target_id);
        if (subSub) return `${cat.name} > ${sub.name} > ${subSub.name}`;
      }
    }
    return discount.target_id;
  }

  if (discount.scope === 'PRODUCT') {
    const prod = products.find(p => p.id === discount.target_id);
    return prod ? prod.name : discount.target_id;
  }

  if (discount.scope === 'VARIANT') {
    const variants = parseVariantTargets(discount.target_id);
    const formatted = variants.map(v => {
      const prod = products.find(p => p.id === v.productId);
      const pName = prod ? prod.name : 'Unknown Product';
      return `${pName} (${v.size || 'Any'}, ${v.color || 'Any'})`;
    });
    return formatted.join(' | ');
  }

  return discount.target_id;
}
