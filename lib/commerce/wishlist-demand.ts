/**
 * COMMERCE layer — turning saved products into a restocking decision.
 *
 * "Most wishlisted" on its own is a popularity chart, and a popularity chart
 * does not tell anybody what to do. The useful question is narrower: **what do
 * people want that they cannot currently buy?** A sold-out product twelve
 * people saved is an order to place this week; the same twelve on something
 * with forty in stock is just a product doing well.
 *
 * So demand is ranked with availability folded in, and each row says which
 * kind it is. Pure, so the ranking is testable without a database.
 */
import { getStockStatus, type StockLevel } from './stock';

/** One row of the most_wishlisted view. */
export interface WishlistDemandRow {
  product_id: string | null;
  product_name: string | null;
  main_image: string | null;
  stock: number | null;
  price: number | null;
  saved_by: number | null;
  last_saved_at: string | null;
}

export interface WishlistDemandEntry {
  productId: string;
  name: string;
  image: string | null;
  stock: number;
  price: number;
  savedBy: number;
  lastSavedAt: string | null;
  /** 'out' and 'low' are the rows worth acting on. */
  level: StockLevel;
  /** True when people are waiting on something they cannot buy. */
  unmet: boolean;
}

/**
 * How much a sold-out product outranks an in-stock one with the same number of
 * savers. Three is deliberate rather than tuned: it is enough that four people
 * waiting on something unavailable beats eleven admiring something in stock,
 * which is the judgement an owner would make by eye.
 */
const UNMET_WEIGHT = 3;

function scoreOf(entry: WishlistDemandEntry): number {
  if (entry.level === 'out') return entry.savedBy * UNMET_WEIGHT;
  if (entry.level === 'low') return entry.savedBy * 2;
  return entry.savedBy;
}

export function rankWishlistDemand(rows: WishlistDemandRow[], limit: number): WishlistDemandEntry[] {
  const entries: WishlistDemandEntry[] = [];

  for (const row of rows) {
    if (!row.product_id) continue;

    const stock = Number(row.stock ?? 0);
    const level = getStockStatus(stock).level;

    entries.push({
      productId: row.product_id,
      name: row.product_name ?? 'Untitled product',
      image: row.main_image,
      stock,
      price: Number(row.price ?? 0),
      savedBy: Number(row.saved_by ?? 0),
      lastSavedAt: row.last_saved_at,
      level,
      unmet: level !== 'in',
    });
  }

  return entries
    .sort((a, b) => scoreOf(b) - scoreOf(a) || b.savedBy - a.savedBy)
    .slice(0, limit);
}
