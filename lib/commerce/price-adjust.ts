/**
 * COMMERCE layer — a percentage price change applied to a product and every
 * variant price it carries.
 *
 * End-of-season markdown is the case this exists for: "take 30% off these 60
 * products" should be one action, not 60 form submissions.
 *
 * Both places a price lives are moved together. products.price is what the
 * card shows; pricing_config's per-size / per-colour / per-combination maps are
 * what sync_variants_from_pricing_config derives product_variants from. Writing
 * only one of them looks correct until the next ordinary product save re-syncs
 * from the config and quietly restores the old prices.
 *
 * Pure, so the arithmetic is testable without a database — and so the caller
 * can show a preview before committing anything.
 */
import type { PricingConfig } from '@/types/product';

export interface AdjustablePricing {
  price: number;
  pricing_config?: PricingConfig | null;
}

export interface AdjustedPricing {
  price: number;
  pricing_config: PricingConfig | null;
}

/** The maps in pricing_config that hold money, as opposed to stock or images. */
const PRICE_MAPS = ['sizePrices', 'colorPrices', 'combinationPrices'] as const;

/** The store prices in whole naira — products.price and product_variants.price
 * are both integer columns, so a fractional result is not representable. */
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
  const config = source.pricing_config ?? null;

  if (!config) {
    return { price: applyPercent(source.price, percent), pricing_config: null };
  }

  const next: PricingConfig = { ...config };

  for (const mapName of PRICE_MAPS) {
    const map = config[mapName];
    if (!map || typeof map !== 'object') continue;

    const adjusted: Record<string, number> = {};
    for (const [key, value] of Object.entries(map)) {
      adjusted[key] = applyPercent(value as number, percent);
    }
    next[mapName] = adjusted;
  }

  return { price: applyPercent(source.price, percent), pricing_config: next };
}

/** "30% off" / "10% increase" — the wording used in the confirmation and in
 * the audit trail, so both describe the change the same way. */
export function describePercent(percent: number): string {
  const magnitude = Math.abs(percent);
  return percent < 0 ? `${magnitude}% off` : `${magnitude}% increase`;
}
