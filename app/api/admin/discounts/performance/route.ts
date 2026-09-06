/**
 * What each discount earned and cost.
 *
 * A second request rather than part of the discounts list, for the same reason
 * the stock insights are: the list has to render the moment the discounts come
 * back — that is what the page is for — while this reads every discounted
 * order line in the shop and is the slower question.
 *
 * Read-only, behind store:read like the rest of the discounts screen.
 */
import { NextResponse } from 'next/server';
import { withAdminAuth, type AdminRouteContext } from '@/lib/api/with-admin-auth';
import { REVENUE_STATUSES } from '@/lib/commerce/order-status';
import {
  EMPTY_PERFORMANCE,
  summarisePerformance,
  type DiscountLineFacts,
  type DiscountPerformance,
} from '@/lib/commerce/discount-performance';

export const dynamic = 'force-dynamic';

/** Ceiling on lines pulled in one pass. Past this a shop needs a reporting
 *  job rather than a slower version of this endpoint. */
const MAX_LINES = 20000;

async function getPerformance({ supabase }: AdminRouteContext) {
  // Only lines on orders that count as revenue. A cancelled order's markdown
  // was never given to anybody, and counting it would make every campaign look
  // more expensive than it was.
  const { data, error } = await supabase
    .from('order_items')
    .select('discount_id, order_id, price, base_price, quantity, orders!inner(status), product_variants(cost)')
    .not('discount_id', 'is', null)
    .in('orders.status', REVENUE_STATUSES)
    .limit(MAX_LINES);

  if (error) {
    // Almost always a deployment that has not applied 20260906150000 — the
    // discount_id column would not exist. The page shows the discounts without
    // their performance rather than failing.
    console.error('Could not read discount performance:', error);
    return NextResponse.json({ success: true, performance: {}, unavailable: true });
  }

  const linesByDiscount = new Map<string, DiscountLineFacts[]>();
  const ordersByDiscount = new Map<string, Set<string>>();

  for (const row of (data ?? []) as any[]) {
    const id = row.discount_id as string;

    const lines = linesByDiscount.get(id) ?? [];
    lines.push({
      price: Number(row.price) || 0,
      basePrice: typeof row.base_price === 'number' ? row.base_price : null,
      quantity: Number(row.quantity) || 0,
      cost: typeof row.product_variants?.cost === 'number' ? row.product_variants.cost : null,
    });
    linesByDiscount.set(id, lines);

    // Counted as distinct orders, not lines: a three-item order that all took
    // the same sale is one order that used it, and reporting it as three would
    // triple every campaign's apparent reach.
    const orders = ordersByDiscount.get(id) ?? new Set<string>();
    if (row.order_id) orders.add(row.order_id as string);
    ordersByDiscount.set(id, orders);
  }

  const performance: Record<string, DiscountPerformance> = {};
  for (const [id, lines] of linesByDiscount) {
    performance[id] = summarisePerformance(lines, ordersByDiscount.get(id)?.size ?? 0);
  }

  return NextResponse.json({
    success: true,
    performance,
    // So the page can distinguish "this campaign sold nothing" from "there is
    // no data for it", which read identically as a row of zeroes.
    empty: EMPTY_PERFORMANCE,
    truncated: (data?.length ?? 0) >= MAX_LINES,
  });
}

export const GET = withAdminAuth((_request, ctx) => getPerformance(ctx));
