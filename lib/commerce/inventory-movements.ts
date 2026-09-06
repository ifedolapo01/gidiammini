/**
 * COMMERCE layer — the vocabulary of the inventory ledger. Pure.
 *
 * inventory_movements.reason is the one field the database cannot work out for
 * itself, and the one the whole feature turns on: velocity computed over admin
 * corrections is a fiction, and a delivery counted as dead stock is worse than
 * no report at all. So the reasons are named once, here, and the two places
 * that can produce one — the Stock page's save and the bulk stock set — pick
 * from this list rather than each inventing a string the CHECK will refuse.
 */

/** Every reason a movement can carry. Mirrors the CHECK in migration
 *  20260906120000_inventory_movements.sql exactly. */
export const MOVEMENT_REASONS = [
  'sale',
  'release',
  'restock',
  'adjustment',
  'stock_take',
  'variant_edit',
] as const;

export type MovementReason = (typeof MOVEMENT_REASONS)[number];

/**
 * The subset an admin may choose when saving a stock level.
 *
 * Deliberately narrower than the full list, and enforced again by
 * set_variant_stock(): 'sale' and 'release' belong to the checkout, and letting
 * the Stock page claim either would put corrections into the demand figures
 * that drive reorder points.
 */
export const STOCK_EDIT_REASONS = ['restock', 'adjustment', 'stock_take'] as const;

export type StockEditReason = (typeof STOCK_EDIT_REASONS)[number];

/** The honest default for a number somebody changed without saying why. */
export const DEFAULT_STOCK_EDIT_REASON: StockEditReason = 'adjustment';

export interface StockEditReasonInfo {
  value: StockEditReason;
  label: string;
  /** Shown beside the option, because the difference between these three is
   *  invisible on the Stock page and decisive in every report built on them. */
  description: string;
}

export const STOCK_EDIT_REASON_INFO: readonly StockEditReasonInfo[] = [
  {
    value: 'restock',
    label: 'Restock',
    description: 'New units arrived. Resets how long this line has been sitting.',
  },
  {
    value: 'adjustment',
    label: 'Correction',
    description: 'The number was wrong. Does not count as demand or as a delivery.',
  },
  {
    value: 'stock_take',
    label: 'Stock take',
    description: 'Counted the shelf. Records the difference against what the system believed.',
  },
];

/** Narrows an untrusted value to a reason the Stock page may use, falling back
 *  rather than rejecting — a missing reason is an older client, not an attack,
 *  and refusing the save would cost a stock correction over a label. */
export function parseStockEditReason(value: unknown): StockEditReason {
  return STOCK_EDIT_REASONS.includes(value as StockEditReason)
    ? (value as StockEditReason)
    : DEFAULT_STOCK_EDIT_REASON;
}

/** How a movement reads in a timeline. */
export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  sale: 'Sold',
  release: 'Returned to stock',
  restock: 'Restocked',
  adjustment: 'Corrected',
  stock_take: 'Stock take',
  variant_edit: 'Variant edited',
};
