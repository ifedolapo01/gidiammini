/**
 * COMMERCE layer (server only) — the bits both ledger queries need.
 *
 * A leaf module by design. inventory-query.ts answers questions about one
 * variant and inventory-size-query.ts answers one about the whole size run;
 * both need the same window arithmetic, the same row cap and the same row
 * shape. Keeping those in either of the two would make it import the other,
 * which is exactly the circle review-query.ts and product-listing-query.ts
 * were once in — see the header of product-cache.ts.
 */
import 'server-only';

/** How far back the reports look, unless asked otherwise. A quarter is long
 *  enough to cover a buying cycle and short enough that last season's demand
 *  does not drive this season's order. */
export const DEFAULT_WINDOW_DAYS = 90;

/** Ceiling on rows pulled for one report. A shop doing 200 sales a day fills
 *  this in three months; past that the oldest movements are dropped, which
 *  skews a rate less than timing out would. */
export const MAX_MOVEMENT_ROWS = 20000;

/** ISO timestamp `days` ago. */
export function windowStart(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** One row of inventory_movements, as the reports select it. */
export interface MovementRow {
  variant_id: string;
  delta: number;
  reason: string;
  created_at: string;
  stock_after: number;
}
