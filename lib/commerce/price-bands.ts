/**
 * COMMERCE layer — turning a catalogue's price range into shoppable bands.
 *
 * "Under ₦5,000" is a question a parent actually has. A min/max pair of number
 * inputs is not — it asks the shopper to guess what the store charges before
 * they can filter by it.
 *
 * The bands are derived from the catalogue rather than hardcoded, because a
 * fixed ladder goes wrong in both directions: a store selling ₦2,000 bibs gets
 * one band containing everything, and a store selling ₦80,000 christening
 * gowns gets a "₦20,000+" band containing everything. Boundaries are chosen
 * from a ladder of round numbers so they read as prices a person would say.
 *
 * Pure.
 */
import { formatCurrency } from './pricing';

export interface PriceBand {
  /** Stable across renders and safe as a URL value / React key. */
  id: string;
  label: string;
  min: number | null;
  max: number | null;
}

/** Round numbers a shopper would name out loud, in naira. */
const LADDER = [
  1_000, 2_000, 2_500, 5_000, 7_500, 10_000, 15_000, 20_000, 25_000,
  30_000, 40_000, 50_000, 75_000, 100_000, 150_000, 200_000, 500_000,
];

/** Enough to narrow a catalogue; more than this is a wall of radio buttons. */
const MAX_BANDS = 5;

/**
 * Picks up to MAX_BANDS - 1 boundaries strictly inside the range, spread across
 * it rather than bunched at one end.
 */
function chooseBoundaries(min: number, max: number): number[] {
  const inside = LADDER.filter((value) => value > min && value < max);
  if (inside.length <= MAX_BANDS - 1) return inside;

  // Even sampling across the candidates keeps the bands roughly equal in
  // width instead of returning the cheapest four.
  const step = inside.length / (MAX_BANDS - 1);
  const picked: number[] = [];
  for (let i = 0; i < MAX_BANDS - 1; i++) {
    picked.push(inside[Math.floor(i * step)]);
  }
  return [...new Set(picked)];
}

/**
 * Bands covering [min, max], contiguous and non-overlapping.
 *
 * Returns an empty array when there is nothing to divide — a catalogue where
 * everything costs the same, or an empty one. The caller shows no price facet
 * at all in that case, which is honest: there is no choice to make.
 */
export function buildPriceBands(min: number, max: number): PriceBand[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || max <= 0) {
    return [];
  }

  const boundaries = chooseBoundaries(Math.max(min, 0), max);
  if (boundaries.length === 0) return [];

  const bands: PriceBand[] = [];
  let lower: number | null = null;

  for (const boundary of boundaries) {
    bands.push({
      id: `${lower ?? ''}-${boundary}`,
      // The upper bound is exclusive, so the label says "under" and the
      // boundary itself belongs to the band above. Bands that both include
      // 10,000 would double-count every product priced at exactly that.
      label: lower === null ? `Under ${formatCurrency(boundary)}` : `${formatCurrency(lower)} – ${formatCurrency(boundary)}`,
      min: lower,
      max: boundary - 1,
    });
    lower = boundary;
  }

  bands.push({
    id: `${lower}-`,
    label: `${formatCurrency(lower as number)} and above`,
    min: lower,
    max: null,
  });

  return bands;
}

/** Which band, if any, the current min/max selection corresponds to. */
export function matchPriceBand(
  bands: readonly PriceBand[],
  minPrice: number | null,
  maxPrice: number | null
): PriceBand | null {
  return bands.find((band) => band.min === minPrice && band.max === maxPrice) ?? null;
}

/** Label for a min/max pair that is not one of the offered bands. */
export function describePriceRange(minPrice: number | null, maxPrice: number | null): string {
  if (minPrice !== null && maxPrice !== null) {
    return `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`;
  }
  if (minPrice !== null) return `${formatCurrency(minPrice)} and above`;
  if (maxPrice !== null) return `Under ${formatCurrency(maxPrice + 1)}`;
  return 'Any price';
}
