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
