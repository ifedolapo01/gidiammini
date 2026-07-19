// lib/commerce/stock-adjustment.ts
// Shared helpers for mutating a product's pricing_config stock buckets
// (single/size/color/combination). Two distinct operations are exposed
// because the two call sites need different semantics:
//  - adjustVariantStockByDelta: apply a signed +/- delta across a set of
//    order items (used when an order's confirmed/cancelled status flips).
//  - setVariantStock: set an absolute new value for one variant key
//    (used by the admin "edit stock" endpoint).
import type { PricingConfig } from '@/types/product';

export interface StockDeltaItem {
  size?: string | null;
  color?: string | null;
  quantity: number;
}

/**
 * Applies a signed quantity delta to a product's stock and pricing_config,
 * across a list of order items belonging to that product. `willBeConfirmed`
 * decides the sign: confirming decrements stock, cancelling increments it.
 *
 * Mirrors the exact logic previously inlined in app/api/orders/[id]/route.ts.
 */
export function adjustVariantStockByDelta(
  pricingConfig: PricingConfig | null | undefined,
  currentStock: number,
  items: StockDeltaItem[],
  willBeConfirmed: boolean
): { stock: number; pricingConfig: PricingConfig | null } {
  let newStock = currentStock;
  let config: PricingConfig | null = pricingConfig ? { ...pricingConfig } : null;

  for (const item of items) {
    const qty = willBeConfirmed ? -item.quantity : item.quantity; // Decrement if confirming, increment if cancelling

    if (config) {
      if (config.mode === 'single') {
        if (config.singleStock !== undefined) config.singleStock += qty;
        newStock += qty;
      } else if (config.mode === 'size' && item.size) {
        if (config.sizeStock?.[item.size] !== undefined) config.sizeStock[item.size] += qty;
        newStock += qty;
      } else if (config.mode === 'color' && item.color) {
        if (config.colorStock?.[item.color] !== undefined) config.colorStock[item.color] += qty;
        newStock += qty;
      } else if (config.mode === 'combination' && item.size && item.color) {
        const key = `${item.size}|${item.color}`;
        if (config.combinationStock?.[key] !== undefined) config.combinationStock[key] += qty;
        newStock += qty;
      } else {
        newStock += qty; // fallback
      }
    } else {
      newStock += qty;
    }
  }

  return { stock: newStock, pricingConfig: config };
}

/**
 * Sets an absolute new stock value for a single variant key (or the whole
 * product, when mode is 'single'), recomputing the product's total stock by
 * replacing the old bucket value with the new one.
 *
 * Mirrors the exact logic previously inlined in
 * app/api/admin/products/[id]/stock/route.ts.
 */
export function setVariantStock(
  pricingConfig: PricingConfig | { mode: string } | null | undefined,
  currentStock: number,
  variantKey: string,
  newStockVal: number
): { stock: number; pricingConfig: any } {
  let newTotalStock = currentStock || 0;
  const config: any = pricingConfig || { mode: 'single' };

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
