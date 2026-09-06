/**
 * COMMERCE layer — the shapes the inventory readings are expressed in.
 *
 * Apart from inventory-analytics.ts so a component or an API route can name a
 * VariantInsight without importing the arithmetic, and so neither file grows
 * past the project's line cap. Same split as price-order.types.ts.
 */

/** What the ledger knows about one variant over a window. */
export interface VariantMovementFacts {
  variantId: string;
  /** Units sold in the window. Only reason = 'sale' — a correction is not
   *  demand, and counting it as such is how a reorder point ends up ordering
   *  against somebody's typo. */
  soldUnits: number;
  /** What is on the shelf now. */
  stock: number;
  /** When this variant last sold anything, ever — not just in the window.
   *  Null means it has never sold since the ledger began. */
  lastSaleAt: string | null;
  /** When units last arrived. Null if never restocked since the ledger began. */
  lastRestockAt: string | null;
  /** How many days of ledger history exist for this shop. The same for every
   *  variant; carried per-variant so a caller cannot forget to pass it. */
  observedDays: number;
}

export interface ReorderPolicy {
  /** Days between placing an order with a supplier and it being on the shelf. */
  leadDays: number;
  /** How many days of stock to hold beyond the lead time. The buffer that
   *  absorbs a good week. */
  coverDays: number;
}

export type StockMomentum = 'selling' | 'slow' | 'stale' | 'dead' | 'unknown';

export interface VariantInsight {
  variantId: string;
  /** Units per day. 0 when nothing sold. */
  velocity: number;
  /** Days the current stock will last at that velocity. Null when nothing is
   *  selling — an infinity rendered as a number invites somebody to sort by it. */
  daysOfCover: number | null;
  /** Of everything that was available in the window, the share that sold.
   *  Null when there was nothing to sell. */
  sellThrough: number | null;
  /** Reorder when stock falls to this. */
  reorderPoint: number;
  /** How many to buy now. 0 when there is nothing to do. */
  suggestedOrder: number;
  /** Whether stock is at or below the reorder point and something should be
   *  bought. False when the line does not sell at all — that is a clearance
   *  problem, not a buying one. */
  needsReorder: boolean;
  /** Days since it last sold. Null if it never has. */
  daysSinceLastSale: number | null;
  momentum: StockMomentum;
  /** How many days of ledger this rests on. */
  observedDays: number;
  /** False while the ledger is too young for the velocity to mean anything.
   *  The UI must say so rather than presenting a confident number. */
  confident: boolean;
}
