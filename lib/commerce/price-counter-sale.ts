/**
 * COMMERCE layer — prices a counter sale against the live catalogue.
 *
 * A slimmer sibling of price-order.ts, not a branch inside it: priceOrder()
 * goes through loadPricingContext(), which unconditionally resolves a
 * shipping zone from a state and fails the whole quote when none matches —
 * exactly right for a delivery, meaningless for a sale rung up at the till.
 * A counter sale has no address, no zone and no delivery fee; shipping is
 * always 0. Everything else — variant price, automatic discounts, tax,
 * stock — is the same arithmetic, reused from the same pure helpers.
 *
 * No discount *code* input exists on the counter-sale screen (see
 * lib/api/admin-roles.ts — a cashier has no discounts:write-shaped
 * permission), so only automatic, codeless discounts ever apply here.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/types/product';
import { ADMIN_VARIANTS_SELECT } from './product-variants';
import { mergeCartLines, parseCartLines } from './cart-input';
import { automaticLineDiscounts, type Discount } from './discounts';
import { priceCartLines, sumOf } from './price-lines';
import { calculateTax } from './checkout';
import { loadPublicStoreSettings } from './store-settings-server';
import type { CounterSalePriced } from './counter-sale.types';

export type PriceCounterSaleResult =
  | { ok: true; priced: CounterSalePriced }
  | { ok: false; error: string; status: number };

function fail(error: string, status = 400): { ok: false; error: string; status: number } {
  return { ok: false, error, status };
}

export async function priceCounterSale(
  supabase: SupabaseClient,
  items: unknown
): Promise<PriceCounterSaleResult> {
  const parsed = parseCartLines(items);
  if (typeof parsed === 'string') return fail(parsed);

  const lines = mergeCartLines(parsed);
  const productIds = [...new Set(lines.map((line) => line.product_id))];

  const [productsResult, discountsResult, settings] = await Promise.all([
    supabase.from('products').select(`*, ${ADMIN_VARIANTS_SELECT}`).in('id', productIds).eq('is_active', true),
    supabase.from('discounts').select('*').eq('is_active', true),
    loadPublicStoreSettings(),
  ]);

  if (productsResult.error) {
    return fail('We could not load the latest prices. Please try again.', 503);
  }

  const products = (productsResult.data || []) as Product[];
  const byId = new Map(products.map((product) => [product.id, product]));

  if (productIds.some((id) => !byId.has(id))) {
    return fail('One or more items are no longer available. Please review the sale.');
  }

  const discounts = (discountsResult.data || []) as Discount[];
  const automatic = automaticLineDiscounts(discounts);

  const pricedItems = priceCartLines({ lines, productsById: byId, candidates: automatic });
  const subtotal = sumOf(pricedItems);
  const tax = calculateTax(subtotal, settings.taxRate);

  return {
    ok: true,
    priced: {
      items: pricedItems,
      subtotal,
      tax,
      shipping: 0,
      total: subtotal + tax,
    },
  };
}
