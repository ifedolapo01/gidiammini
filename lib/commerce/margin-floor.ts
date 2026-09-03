/**
 * COMMERCE layer — which variants a discount would push below cost.
 *
 * The point of recording a cost price is to stop a discount being set blind.
 * A 40% sitewide sale is fine on a 70%-margin line and a loss on a 25% one, and
 * nothing in the form has ever said which is which.
 *
 * Only variants with a recorded cost can be checked. A variant with no cost is
 * unknown, not safe — so it is reported separately as unchecked rather than
 * counted as fine, and never as a loss.
 *
 * Pure, so the rule is testable without a database or a form.
 */
import { calculateDiscountedPrice, type Discount } from './discounts';
import { variantsOf, variantLabel, type ProductVariant } from './product-variants';
import { parseVariantTargets } from './discount-target';

interface ProductLike {
  id: string;
  name: string;
  category?: string | null;
  sub_category?: string | null;
  is_active?: boolean;
  product_variants?: ProductVariant[] | null;
}

export interface BelowCostVariant {
  productId: string;
  productName: string;
  variantKey: string;
  label: string;
  price: number;
  cost: number;
  discountedPrice: number;
  /** How much every unit sold at this discount loses. Always positive. */
  lossPerUnit: number;
}

export interface MarginFloorResult {
  /** Variants that would sell below cost. Worst loss first. */
  below: BelowCostVariant[];
  /** Variants the discount touches that have no cost recorded, so cannot be
   * checked. Reported so a clean result is not mistaken for a complete one. */
  uncheckedCount: number;
  /** Variants the discount touches and that have a cost. */
  checkedCount: number;
}

const EMPTY: MarginFloorResult = { below: [], uncheckedCount: 0, checkedCount: 0 };

/** Every variant the discount's scope covers. */
function affectedVariants(
  products: ProductLike[],
  discount: Pick<Discount, 'scope' | 'target_id'>
): Array<{ product: ProductLike; variant: ProductVariant }> {
  const active = products.filter((product) => product.is_active !== false);
  const pairs = (list: ProductLike[]) =>
    list.flatMap((product) =>
      variantsOf(product)
        .filter((variant) => variant.is_active)
        .map((variant) => ({ product, variant }))
    );

  switch (discount.scope) {
    case 'SITEWIDE':
      return pairs(active);

    case 'CATEGORY':
      return pairs(active.filter((product) => product.category === discount.target_id));

    case 'SUBCATEGORY':
      return pairs(active.filter((product) => product.sub_category === discount.target_id));

    case 'PRODUCT':
      return pairs(active.filter((product) => product.id === discount.target_id));

    case 'VARIANT': {
      // target_id is "productId:size:color,productId:size:color".
      const targets = parseVariantTargets(discount.target_id ?? '');
      return pairs(active).filter(({ product, variant }) =>
        targets.some(
          (target) =>
            target.productId === product.id &&
            (target.size || null) === (variant.size || null) &&
            (target.color || null) === (variant.color || null)
        )
      );
    }

    default:
      return [];
  }
}

/**
 * Checks a proposed discount against every variant it would apply to.
 *
 * `discount` is the form's current state, not a saved row — the warning has to
 * appear while the value is being typed, before anything is saved.
 */
export function findBelowCostVariants(
  products: ProductLike[],
  discount: Pick<Discount, 'type' | 'value' | 'scope' | 'target_id'>
): MarginFloorResult {
  if (!Number.isFinite(discount.value) || discount.value <= 0) return { ...EMPTY };

  const affected = affectedVariants(products, discount);
  if (affected.length === 0) return { ...EMPTY };

  const below: BelowCostVariant[] = [];
  let checkedCount = 0;
  let uncheckedCount = 0;

  for (const { product, variant } of affected) {
    const cost = typeof variant.cost === 'number' ? variant.cost : null;

    if (cost === null) {
      uncheckedCount += 1;
      continue;
    }

    checkedCount += 1;

    const price = Number(variant.price) || 0;
    // Reuses the same rounding the storefront and the order pricing use, so the
    // warning reflects the figure that would actually be charged.
    const discountedPrice = calculateDiscountedPrice(price, {
      ...(discount as Discount),
      id: 'preview',
      name: 'preview',
      is_active: true,
      start_date: null,
      end_date: null,
    });

    if (discountedPrice < cost) {
      below.push({
        productId: product.id,
        productName: product.name,
        variantKey: variant.variant_key,
        label: variantLabel(variant),
        price,
        cost,
        discountedPrice,
        lossPerUnit: cost - discountedPrice,
      });
    }
  }

  below.sort((a, b) => b.lossPerUnit - a.lossPerUnit);

  return { below, uncheckedCount, checkedCount };
}
