/**
 * COMMERCE layer (server only) — reading the inventory ledger.
 *
 * Three questions, three reads. Kept apart from inventory-analytics.ts so the
 * arithmetic stays testable without a database, and apart from
 * admin-products-query.ts because the stock table's rows and their movement
 * history are fetched independently — the table paginates, and the insights
 * are then asked for only the variants on screen rather than the catalogue.
 *
 * WHY THE AGGREGATION HAPPENS HERE AND NOT IN SQL
 *
 * A grouped query per request would be tidier, but PostgREST cannot express
 * "sum where reason = 'sale', and separately the max created_at where reason =
 * 'restock'" without a database function, and a function is a migration every
 * time the shape of a report changes. The rows are narrow (five columns) and
 * bounded by the window, so pulling them and folding in TypeScript costs
 * little and keeps the reports editable. If a shop's ledger ever outgrows
 * that, this is the one file that has to change.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VariantMovementFacts } from './inventory-analytics';
import { DEFAULT_WINDOW_DAYS, MAX_MOVEMENT_ROWS, windowStart, type MovementRow } from './inventory-window';

export { DEFAULT_WINDOW_DAYS } from './inventory-window';

/**
 * How much ledger history actually exists, in days.
 *
 * The number every velocity is divided by. Read once per report rather than
 * assumed, because the ledger cannot be backfilled and dividing three days of
 * sales by ninety would understate every rate by a factor of thirty.
 */
export async function observedLedgerDays(
  supabase: SupabaseClient,
  windowDays: number = DEFAULT_WINDOW_DAYS
): Promise<number> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.created_at) return 0;

  const elapsed = Math.floor((Date.now() - Date.parse(data.created_at)) / (24 * 60 * 60 * 1000));
  // Never longer than the window asked for: a two-year-old ledger read over 90
  // days has 90 days of evidence for this report, not 730.
  return Math.max(0, Math.min(windowDays, elapsed));
}

/** Current stock per variant, for the variants asked about. */
async function stockByVariant(
  supabase: SupabaseClient,
  variantIds: string[]
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from('product_variants')
    .select('id, stock')
    .in('id', variantIds);

  return new Map((data ?? []).map((row: any) => [row.id as string, Number(row.stock) || 0]));
}

/**
 * Sales, last sale and last restock per variant over the window.
 *
 * `lastSaleAt` deliberately ignores the window: "nothing since March" is the
 * answer the aging report needs, and a 90-day window would report it as "never
 * sold", which reads as a data problem rather than as dead stock. So the last
 * sale is a second, tiny query with no lower bound.
 */
export async function fetchVariantFacts(
  supabase: SupabaseClient,
  variantIds: string[],
  windowDays: number = DEFAULT_WINDOW_DAYS
): Promise<VariantMovementFacts[]> {
  if (variantIds.length === 0) return [];

  const [movements, stock, observedDays, lastSales] = await Promise.all([
    supabase
      .from('inventory_movements')
      .select('variant_id, delta, reason, created_at, stock_after')
      .in('variant_id', variantIds)
      .gte('created_at', windowStart(windowDays))
      .limit(MAX_MOVEMENT_ROWS),
    stockByVariant(supabase, variantIds),
    observedLedgerDays(supabase, windowDays),
    lastSaleByVariant(supabase, variantIds),
  ]);

  const rows = (movements.data ?? []) as MovementRow[];

  const sold = new Map<string, number>();
  const lastRestock = new Map<string, string>();

  for (const row of rows) {
    if (row.reason === 'sale') {
      // delta is negative for a sale; demand is the magnitude.
      sold.set(row.variant_id, (sold.get(row.variant_id) ?? 0) + Math.abs(row.delta));
    } else if (row.reason === 'restock') {
      const current = lastRestock.get(row.variant_id);
      if (!current || row.created_at > current) lastRestock.set(row.variant_id, row.created_at);
    }
  }

  return variantIds.map((variantId) => ({
    variantId,
    soldUnits: sold.get(variantId) ?? 0,
    stock: stock.get(variantId) ?? 0,
    lastSaleAt: lastSales.get(variantId) ?? null,
    lastRestockAt: lastRestock.get(variantId) ?? null,
    observedDays,
  }));
}

/** The most recent sale per variant, at any depth of history. */
async function lastSaleByVariant(
  supabase: SupabaseClient,
  variantIds: string[]
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('inventory_movements')
    .select('variant_id, created_at')
    .in('variant_id', variantIds)
    .eq('reason', 'sale')
    .order('created_at', { ascending: false })
    .limit(MAX_MOVEMENT_ROWS);

  const latest = new Map<string, string>();
  // Ordered newest first, so the first sighting of a variant is its last sale.
  for (const row of (data ?? []) as { variant_id: string; created_at: string }[]) {
    if (!latest.has(row.variant_id)) latest.set(row.variant_id, row.created_at);
  }
  return latest;
}
