/**
 * COMMERCE layer — what the inventory ledger means. Pure.
 *
 * Turns "these movements happened" into the four answers the Stock page cannot
 * currently give: how fast this line sells, how long what is left will last,
 * when to reorder and how much, and whether it is moving at all.
 *
 * EVERY FIGURE CARRIES ITS OWN WINDOW
 *
 * inventory_movements starts empty and cannot be backfilled (see migration
 * 20260906120000). Three days after it ships, "sold 6" over a 90-day window is
 * 0.07 a day if you divide by 90 and 2 a day if you divide by the 3 days that
 * actually exist — and the second is right. So velocity divides by the
 * observed window, and every result reports `observedDays` so the UI can say
 * "based on 3 days" rather than presenting a number that looks like a quarter
 * of evidence. A reorder suggestion from three days of data is a guess, and it
 * has to look like one.
 *
 * All of it is pure arithmetic over already-aggregated counts. The aggregation
 * itself is one grouped query in inventory-query.ts.
 */

/** Below this many days of ledger, a velocity is a guess rather than a rate.
 *  Two weeks is roughly the point at which a weekly buying rhythm has shown up
 *  at least once, which is what makes a per-day average mean anything for
 *  apparel. */
export const MIN_CONFIDENT_DAYS = 14;

export type {
  VariantMovementFacts,
  ReorderPolicy,
  StockMomentum,
  VariantInsight,
} from './inventory-analytics.types';

import type {
  ReorderPolicy,
  StockMomentum,
  VariantInsight,
  VariantMovementFacts,
} from './inventory-analytics.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between an ISO timestamp and now, or null for a missing one. */
export function daysSince(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now - then) / DAY_MS));
}

/**
 * Units sold per day.
 *
 * Divided by the observed window, not the requested one. `Math.max(1, ...)`
 * because a ledger that started today has an observed window of zero days, and
 * a shop that sold two things today has sold two things today — not infinitely
 * many.
 */
export function velocityPerDay(soldUnits: number, observedDays: number): number {
  if (soldUnits <= 0) return 0;
  return soldUnits / Math.max(1, observedDays);
}

/**
 * How long the shelf lasts.
 *
 * Null rather than Infinity when nothing is selling: the two are different
 * questions ("it will last 40 days" vs "it is not moving"), and a column that
 * mixes them sorts wrongly and reads worse.
 */
export function daysOfCover(stock: number, velocity: number): number | null {
  if (velocity <= 0) return null;
  return stock / velocity;
}

/**
 * The share of what was available that actually sold.
 *
 * sold / (sold + still on the shelf). The textbook definition divides by units
 * received, which this shop has no reliable record of — deliveries have only
 * been recorded since the ledger began, and a variant that predates it would
 * show an impossible rate. Against opening stock the figure is slightly
 * conservative and always defined, which is the better failure.
 */
export function sellThroughRate(soldUnits: number, stock: number): number | null {
  const available = soldUnits + Math.max(0, stock);
  if (available <= 0) return null;
  return soldUnits / available;
}

/**
 * The level at which to place the next order: enough to cover the wait for it
 * to arrive, plus the buffer.
 *
 * Rounded up. Ordering half a unit late is ordering late.
 */
export function reorderPoint(velocity: number, policy: ReorderPolicy): number {
  if (velocity <= 0) return 0;
  return Math.ceil(velocity * (policy.leadDays + policy.coverDays));
}

/** How many to buy: the gap between the target level and what is on the shelf. */
export function suggestedOrderQuantity(
  stock: number,
  velocity: number,
  policy: ReorderPolicy
): number {
  const target = reorderPoint(velocity, policy);
  return Math.max(0, target - Math.max(0, stock));
}

/**
 * Whether this line is moving.
 *
 * Only meaningful for something there is stock of: a sold-out variant that has
 * not sold in 90 days has not sold because there was nothing to sell, and
 * calling that dead stock would send somebody to discount an empty shelf.
 */
export function stockMomentum(
  daysSinceSale: number | null,
  stock: number,
  observedDays: number
): StockMomentum {
  if (stock <= 0) return 'unknown';
  // Nothing sold, and not enough history to say that means anything.
  if (daysSinceSale === null) return observedDays >= 30 ? 'dead' : 'unknown';
  if (daysSinceSale < 30) return 'selling';
  if (daysSinceSale < 60) return 'slow';
  if (daysSinceSale < 90) return 'stale';
  return 'dead';
}

/** The whole reading for one variant. */
export function variantInsight(
  facts: VariantMovementFacts,
  policy: ReorderPolicy,
  now: number = Date.now()
): VariantInsight {
  const velocity = velocityPerDay(facts.soldUnits, facts.observedDays);
  const daysSinceLastSale = daysSince(facts.lastSaleAt, now);
  const point = reorderPoint(velocity, policy);

  return {
    variantId: facts.variantId,
    velocity,
    daysOfCover: daysOfCover(facts.stock, velocity),
    sellThrough: sellThroughRate(facts.soldUnits, facts.stock),
    reorderPoint: point,
    suggestedOrder: suggestedOrderQuantity(facts.stock, velocity, policy),
    // A line that does not sell is never "needs reorder", however low it is.
    needsReorder: velocity > 0 && facts.stock <= point,
    daysSinceLastSale,
    momentum: stockMomentum(daysSinceLastSale, facts.stock, facts.observedDays),
    observedDays: facts.observedDays,
    confident: facts.observedDays >= MIN_CONFIDENT_DAYS,
  };
}
