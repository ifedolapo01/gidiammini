// lib/commerce/stock-adjustment.ts
// Sets an absolute stock value for one variant bucket, recomputing the
// product's total. Used by the admin "edit stock" endpoint.
//
// NOTE: a companion adjustVariantStockByDelta() used to live here, applying a
// signed +/- delta across a set of order items. It was superseded by the
// adjust_order_stock() Postgres function
// (supabase/migrations/20251101001500_stock_reservation.sql), which does the
// same arithmetic atomically and under a row lock, and was left with zero
// callers. Deleted rather than kept as a JS "reference copy": nothing exercised
// it against the SQL, so the two would have drifted apart silently while
// looking authoritative.
import type { PricingConfig } from '@/types/product';

/**
 * Sets an absolute new stock value for a single variant key (or the whole
 * product, when mode is 'single'), recomputing the product's total stock by
 * replacing the old bucket value with the new one.
 *
 * Mirrors the exact logic previously inlined in
 * app/api/admin/products/[id]/stock/route.ts. Returns a new pricing_config
 * rather than editing the one passed in.
 */
export function setVariantStock(
  pricingConfig: PricingConfig | { mode: string } | null | undefined,
  currentStock: number,
  variantKey: string,
  newStockVal: number
): { stock: number; pricingConfig: any } {
  let newTotalStock = currentStock || 0;

  // Deep-copied: a shallow spread shares the nested bucket maps, so writing to
  // config.combinationStock[key] would rewrite the caller's own object. The
  // buckets are plain string->number maps, so a structured clone is enough.
  const source: any = pricingConfig || { mode: 'single' };
  const config: any = {
    ...source,
    ...(source.singleStock !== undefined && { singleStock: source.singleStock }),
    ...(source.sizeStock && { sizeStock: { ...source.sizeStock } }),
    ...(source.colorStock && { colorStock: { ...source.colorStock } }),
    ...(source.combinationStock && { combinationStock: { ...source.combinationStock } }),
  };

  if (variantKey === 'single' || config.mode === 'single') {
    newTotalStock = newStockVal;
    config.singleStock = newStockVal;
  } else if (config.mode === 'combination') {
    const oldStock = config.combinationStock?.[variantKey] || 0;
    if (!config.combinationStock) config.combinationStock = {};
    config.combinationStock[variantKey] = newStockVal;
    newTotalStock = newTotalStock - oldStock + newStockVal;
  } else if (config.mode === 'size') {
    const oldStock = config.sizeStock?.[variantKey] || 0;
    if (!config.sizeStock) config.sizeStock = {};
    config.sizeStock[variantKey] = newStockVal;
    newTotalStock = newTotalStock - oldStock + newStockVal;
  } else if (config.mode === 'color') {
    const oldStock = config.colorStock?.[variantKey] || 0;
    if (!config.colorStock) config.colorStock = {};
    config.colorStock[variantKey] = newStockVal;
    newTotalStock = newTotalStock - oldStock + newStockVal;
  }

  return { stock: newTotalStock, pricingConfig: config };
}
