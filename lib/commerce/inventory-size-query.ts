/**
 * COMMERCE layer (server only) — demand per size, across the whole catalogue.
 *
 * Split from inventory-query.ts because it asks at a different grain. That
 * file answers "what has this variant been doing"; this one folds every
 * variant in the shop into one row per size, which is the only grain at which
 * "buy more 6-12 months" is a sentence worth saying.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SizeFacts } from './size-demand';
import { DEFAULT_WINDOW_DAYS, MAX_MOVEMENT_ROWS, windowStart, type MovementRow } from './inventory-window';

/**
 * Demand and stock per size, across the whole catalogue.
 *
 * Catalogue-wide rather than per page: "which sizes sell out first" is a
 * question about the size run, and answering it from whatever twenty rows
 * happened to be on screen would be worse than not answering it.
 */
export async function fetchSizeFacts(
  supabase: SupabaseClient,
  windowDays: number = DEFAULT_WINDOW_DAYS
): Promise<SizeFacts[]> {
  const [variantsResult, movementsResult] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, size, stock, products!inner(is_active)')
      .eq('products.is_active', true)
      .not('size', 'is', null),
    supabase
      .from('inventory_movements')
      .select('variant_id, delta, reason, stock_after')
      .eq('reason', 'sale')
      .gte('created_at', windowStart(windowDays))
      .limit(MAX_MOVEMENT_ROWS),
  ]);

  const sizeOf = new Map<string, string>();
  const facts = new Map<string, SizeFacts>();

  for (const variant of (variantsResult.data ?? []) as any[]) {
    const size = String(variant.size ?? '').trim();
    if (!size) continue;

    sizeOf.set(variant.id as string, size);
    const entry = facts.get(size) ?? { size, soldUnits: 0, stockUnits: 0, soldOutCount: 0, variantCount: 0 };
    entry.stockUnits += Number(variant.stock) || 0;
    entry.variantCount += 1;
    facts.set(size, entry);
  }

  for (const row of (movementsResult.data ?? []) as MovementRow[]) {
    const size = sizeOf.get(row.variant_id);
    // A movement whose variant is gone or whose product is no longer active.
    // Dropped rather than bucketed as unknown: it cannot inform a buying
    // decision about something not for sale.
    if (!size) continue;

    const entry = facts.get(size)!;
    entry.soldUnits += Math.abs(row.delta);
    // stock_after is what makes "sells out first" answerable at all: the sale
    // that emptied the shelf is a row, not an absence of one.
    if (row.stock_after <= 0) entry.soldOutCount += 1;
  }

  return [...facts.values()];
}
