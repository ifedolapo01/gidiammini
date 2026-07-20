/** COMMERCE layer — applies (or reverses) an order's stock impact against the
 * products it references, using the low-level per-item math in
 * stock-adjustment.ts. Kept separate from that file's pure functions since
 * this one talks to Supabase directly. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { adjustVariantStockByDelta, type StockDeltaItem } from './stock-adjustment';

interface OrderForStockChange {
  order_items?: Array<StockDeltaItem & { product_id?: string }>;
}

/**
 * `isReserving` true = decrement (an order is claiming stock for the first
 * time); false = increment (a reserved order was cancelled, so its stock goes back).
 */
export async function applyOrderStockChange(
  supabase: SupabaseClient,
  order: OrderForStockChange,
  isReserving: boolean
): Promise<{ error?: string }> {
  const productIds = [...new Set((order.order_items || []).map((item) => item.product_id).filter(Boolean))] as string[];

  if (productIds.length === 0) return {};

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds);

  if (productsError) {
    return { error: 'Failed to fetch products for stock update.' };
  }

  const productUpdates = [];

  for (const product of products || []) {
    const itemsForProduct = (order.order_items || []).filter((item) => item.product_id === product.id);

    const { stock: newStock, pricingConfig } = adjustVariantStockByDelta(
      product.pricing_config,
      product.stock,
      itemsForProduct,
      isReserving
    );

    if (isReserving && newStock < 0) {
      return { error: `Insufficient stock to update order for product: ${product.name}` };
    }

    productUpdates.push({ id: product.id, stock: newStock, pricing_config: pricingConfig });
  }

  for (const update of productUpdates) {
    await supabase.from('products').update({
      stock: update.stock,
      pricing_config: update.pricing_config
    }).eq('id', update.id);
  }

  return {};
}
