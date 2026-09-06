/**
 * What is not moving, and what to buy more of.
 *
 * Two reports in one response because they are read together and neither is
 * large: the aging list answers "what is tying up cash" and the size run
 * answers "what should the next delivery look like". Splitting them would mean
 * two round trips for one screen.
 *
 * Catalogue-wide, unlike the insights endpoint. Both questions are about the
 * shop rather than about a page of it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, type AdminRouteContext } from '@/lib/api/with-admin-auth';
import { readStoreSettings } from '@/lib/commerce/store-settings-server';
import {
  DEFAULT_WINDOW_DAYS,
  fetchVariantFacts,
  observedLedgerDays,
} from '@/lib/commerce/inventory-query';
import { fetchSizeFacts } from '@/lib/commerce/inventory-size-query';
import { variantInsight, type VariantInsight } from '@/lib/commerce/inventory-analytics';
import { sizeInsights } from '@/lib/commerce/size-demand';

export const dynamic = 'force-dynamic';

/** Variants carried into the aging pass. Bounded because this is the one
 *  report that reads the whole catalogue; a shop past this many variants needs
 *  a paginated report rather than a slower version of this one. */
const MAX_VARIANTS = 1000;

/** Rows returned per list. A shopkeeper acts on the worst twenty-five, not on
 *  four hundred. */
const REPORT_ROWS = 25;

interface VariantLabel {
  variantId: string;
  productId: string;
  productName: string;
  label: string;
  stock: number;
  /** Value sitting on the shelf, at cost where cost is known. The number that
   *  turns "17 units unsold" into a reason to do something. */
  tiedUpValue: number | null;
}

async function getAgingReport(request: NextRequest, { supabase }: AdminRouteContext) {
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get('windowDays'));
  const windowDays = Number.isFinite(requested)
    ? Math.min(365, Math.max(7, Math.round(requested)))
    : DEFAULT_WINDOW_DAYS;

  // Only variants with something on the shelf. A sold-out variant cannot be
  // dead stock, and including it would fill the report with lines the shop has
  // already cleared.
  const { data: variantRows, error } = await supabase
    .from('product_variants')
    .select('id, product_id, size, color, stock, cost, price, products!inner(name, is_active)')
    .eq('products.is_active', true)
    .gt('stock', 0)
    .order('stock', { ascending: false })
    .limit(MAX_VARIANTS);

  if (error) {
    console.error('Aging report query failed:', error);
    return NextResponse.json(
      { success: false, error: 'Could not read the stock ledger. Please try again.' },
      { status: 500 }
    );
  }

  const labels = new Map<string, VariantLabel>();
  for (const row of (variantRows ?? []) as any[]) {
    const axes = [row.size, row.color].filter(Boolean).join(' / ');
    const unitValue = typeof row.cost === 'number' ? row.cost : null;

    labels.set(row.id, {
      variantId: row.id,
      productId: row.product_id,
      productName: row.products?.name ?? 'Unknown product',
      label: axes || 'Single',
      stock: Number(row.stock) || 0,
      tiedUpValue: unitValue === null ? null : unitValue * (Number(row.stock) || 0),
    });
  }

  const variantIds = [...labels.keys()];

  const [settings, facts, observedDays, sizeFacts] = await Promise.all([
    readStoreSettings(supabase),
    fetchVariantFacts(supabase, variantIds, windowDays),
    observedLedgerDays(supabase, windowDays),
    fetchSizeFacts(supabase, windowDays),
  ]);

  const policy = { leadDays: settings.reorderLeadDays, coverDays: settings.reorderCoverDays };
  const insights = facts.map((fact) => variantInsight(fact, policy));

  const withLabel = (insight: VariantInsight) => ({ ...insight, ...labels.get(insight.variantId)! });

  // Not moving: stale or dead, worst first. Ranked by money tied up rather
  // than by days idle — 40 units of a ₦12,000 coat sitting for 70 days is a
  // bigger problem than one ₦900 vest sitting for 200, and the report exists
  // to free up cash.
  const aging = insights
    .filter((insight) => insight.momentum === 'stale' || insight.momentum === 'dead')
    .map(withLabel)
    .sort((a, b) => (b.tiedUpValue ?? 0) - (a.tiedUpValue ?? 0) || (b.daysSinceLastSale ?? 0) - (a.daysSinceLastSale ?? 0))
    .slice(0, REPORT_ROWS);

  // Running out: at or below the reorder point, and actually selling. Ranked
  // by how little time is left, because that is the order they have to be
  // dealt with in.
  const reorder = insights
    .filter((insight) => insight.needsReorder)
    .map(withLabel)
    .sort((a, b) => (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity))
    .slice(0, REPORT_ROWS);

  return NextResponse.json({
    success: true,
    windowDays,
    observedDays,
    policy,
    aging,
    reorder,
    sizes: sizeInsights(sizeFacts),
    // What the whole report is worth knowing before reading any of it.
    totals: {
      variantsConsidered: variantIds.length,
      agingCount: insights.filter((i) => i.momentum === 'stale' || i.momentum === 'dead').length,
      reorderCount: insights.filter((i) => i.needsReorder).length,
      tiedUpValue: aging.reduce((sum, row) => sum + (row.tiedUpValue ?? 0), 0),
    },
  });
}

export const GET = withAdminAuth(getAgingReport);
