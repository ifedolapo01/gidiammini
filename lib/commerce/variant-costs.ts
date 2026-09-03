/**
 * COMMERCE layer — per-variant cost prices from the admin product form.
 *
 * Kept apart from product-form-helpers.ts because cost travels by a different
 * route to everything else the form submits, and that distinction is the whole
 * point: see the comment on buildVariantCosts.
 */
import { variantKeyFor } from './product-variants';
import type { BuildPricingConfigParams } from './product-form-helpers';

/**
 * The variant-key → cost map the products API expects as `variant_costs`.
 *
 * Separate from buildPricingConfigFromVariants because cost does not live in
 * pricing_config: that blob is the legacy variant model, and
 * sync_variants_from_pricing_config deliberately leaves cost alone so a save
 * from this form cannot wipe a cost entered elsewhere. Costs therefore travel
 * beside the config and land on the product_variants rows directly.
 *
 * The keys must match public.variant_key(size, color) exactly, which is what
 * variantKeyFor() produces — so it is used rather than re-joining by hand.
 */
export function buildVariantCosts(params: BuildPricingConfigParams): Record<string, number | null> {
  const { hasVariants, hasSizes, hasColors, variants, singleSize, singleColor, singleCost } = params;
  const costs: Record<string, number | null> = {};

  const normalise = (value: number | null | undefined): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;

  if (!hasVariants) {
    costs[variantKeyFor(singleSize, singleColor)] = normalise(singleCost);
    return costs;
  }

  if (hasSizes && hasColors) {
    for (const v of variants) {
      const size = v.size.trim();
      for (const c of v.colors) {
        const color = c.name.trim();
        if (size && color) costs[variantKeyFor(size, color)] = normalise(c.cost);
      }
    }
    return costs;
  }

  if (hasSizes) {
    for (const v of variants) {
      const size = v.size.trim();
      if (size) costs[variantKeyFor(size, null)] = normalise(v.cost);
    }
    return costs;
  }

  if (hasColors) {
    for (const v of variants) {
      for (const c of v.colors) {
        const color = c.name.trim();
        if (color) costs[variantKeyFor(null, color)] = normalise(c.cost);
      }
    }
  }

  return costs;
}
