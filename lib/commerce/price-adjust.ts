/**
 * COMMERCE layer — a percentage price change applied to a product and every
 * variant price it carries.
 *
 * End-of-season markdown is the case this exists for: "take 30% off these 60
 * products" should be one action, not 60 form submissions.
 *
 * Both places a price lives are moved together. products.price is what the
 * card shows; product_variants.price is what is actually charged. Writing
 * only one of them looks correct until the storefront reads the other.
 *
 * Pure, so the arithmetic is testable without a database — and so the caller
 * can show a preview before committing anything.
 */

export interface AdjustableVariant {
  variantKey: string;
  price: number;
}

export interface AdjustablePricing {
  price: number;
  variants: AdjustableVariant[];
}

export interface AdjustedPricing {
  price: number;
  variants: AdjustableVariant[];
}

/** The store prices in whole minor units — products.price and
 * product_variants.price are both integer columns, so a fractional result is
 * not representable. */
function applyPercent(value: number, percent: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric * (1 + percent / 100)));
}

/**
 * `percent` is signed and relative: -30 is "30% off", 10 is "10% dearer".
 * Values outside ±100%… below -100 would mean a negative price, so it is
 * rejected by the caller (see isValidPercent) rather than clamped silently to
 * free.
 */
export function isValidPercent(percent: unknown): percent is number {
  return typeof percent === 'number'
    && Number.isFinite(percent)
    && percent > -100
    && percent <= 1000
    && percent !== 0;
}

export function adjustPricing(source: AdjustablePricing, percent: number): AdjustedPricing {
  return {
    price: applyPercent(source.price, percent),
    variants: source.variants.map((v) => ({
      variantKey: v.variantKey,
      price: applyPercent(v.price, percent),
    })),
  };
}

/** "30% off" / "10% increase" — the wording used in the confirmation and in
 * the audit trail, so both describe the change the same way. */
export function describePercent(percent: number): string {
  const magnitude = Math.abs(percent);
  return percent < 0 ? `${magnitude}% off` : `${magnitude}% increase`;
}
