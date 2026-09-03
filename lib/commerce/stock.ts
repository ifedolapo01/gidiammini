/** COMMERCE layer — shared stock-level classification. Used by Storefront and Admin. */

export type StockLevel = 'in' | 'low' | 'out';
export type StockTone = 'success' | 'warning' | 'destructive';

export interface StockStatus {
  level: StockLevel;
  tone: StockTone;
  /** Default label ('In Stock' / 'Low Stock' / 'Out of Stock'); callers may override. */
  text: string;
}

export function getStockStatus(stock: number, lowStockThreshold = 5): StockStatus {
  if (stock <= 0) return { level: 'out', tone: 'destructive', text: 'Out of Stock' };
  if (stock <= lowStockThreshold) return { level: 'low', tone: 'warning', text: 'Low Stock' };
  return { level: 'in', tone: 'success', text: 'In Stock' };
}

/**
 * Whether a stock change is the moment a product became buyable again.
 *
 * The distinction the restock mail depends on: 0 -> 5 is news to everyone
 * waiting, 4 -> 6 is not. Mailing on the second would train people to ignore
 * the first.
 *
 * A missing previous level is treated as zero, because the only way to have no
 * recorded stock is to have had none.
 */
export function isRestock(previousStock: number | null | undefined, newStock: number): boolean {
  return (previousStock ?? 0) <= 0 && newStock > 0;
}
