/**
 * The dashboard for one window of time, against the window before it.
 *
 * Everything on this page used to be all-time, which meant nothing on it could
 * be compared to anything. This is the endpoint the date range feeds: current
 * period, previous period, the deltas between them, and the two breakdowns
 * that say where the money came from.
 *
 * One request rather than five. Every figure here is read from the same two
 * order queries, and splitting them would mean five round trips that could
 * disagree with each other about which orders were in the window.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, type AdminRouteContext } from '@/lib/api/with-admin-auth';
import { REVENUE_STATUSES } from '@/lib/commerce/order-status';
import { parseRange, rangeFor } from '@/lib/commerce/date-range';
import { comparePeriods, summarisePeriod } from '@/lib/commerce/period-metrics';
import { revenueByCategory, revenueByZone } from '@/lib/commerce/revenue-breakdown';
import {
  MAX_ROWS,
  fetchCategoryLines,
  fetchPeriodOrders,
  fetchPriorCustomers,
  fetchZoneNames,
  type PeriodOrderRow,
} from '@/lib/commerce/dashboard-period-query';

export const dynamic = 'force-dynamic';

function money(value: number | string | null | undefined): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

/** Money kept on one order. Cancelled orders contribute nothing — what is held
 *  against them is a refund waiting to happen, not takings. */
function keptOn(order: PeriodOrderRow): number {
  if (order.status === 'cancelled') return 0;
  return money(order.amount_paid) - money(order.amount_refunded);
}

async function getPeriod(request: NextRequest, { supabase }: AdminRouteContext) {
  const days = parseRange(new URL(request.url).searchParams.get('range'));
  const { current, previous } = rangeFor(days);

  try {
    const [currentOrders, previousOrders, prior, categoryLines, zoneNames] = await Promise.all([
      fetchPeriodOrders(supabase, current),
      fetchPeriodOrders(supabase, previous),
      // Anyone who had ordered before the *current* window opened. Deliberately
      // not before the previous one: both periods' repeat rates are then
      // measured against the same cut-off, and a customer's first-ever order
      // does not become a "repeat" simply because the comparison moved.
      fetchPriorCustomers(supabase, current.from),
      fetchCategoryLines(supabase, current, REVENUE_STATUSES),
      fetchZoneNames(supabase),
    ]);

    const currentMetrics = summarisePeriod(currentOrders, prior.identities);
    const previousMetrics = summarisePeriod(previousOrders, prior.identities);

    return NextResponse.json({
      success: true,
      range: { days, current, previous },
      current: currentMetrics,
      previous: previousMetrics,
      deltas: comparePeriods(currentMetrics, previousMetrics),
      byCategory: revenueByCategory(
        categoryLines.map((line) => ({
          category: line.products?.category ?? null,
          price: Number(line.price) || 0,
          quantity: Number(line.quantity) || 0,
        }))
      ),
      byZone: revenueByZone(
        currentOrders
          // Cancelled orders went nowhere, so they belong in no zone's total.
          .filter((order) => order.status !== 'cancelled')
          .map((order) => ({
            shipping_zone_id: order.shipping_zone_id,
            selected_state: order.selected_state,
            revenue: keptOn(order),
            shipping: money(order.shipping_amount),
          })),
        zoneNames
      ),
      // Said out loud rather than left for somebody to discover: past this,
      // the repeat rate is computed against a partial history and is wrong.
      truncated: prior.truncated || currentOrders.length >= MAX_ROWS,
    });
  } catch (error) {
    console.error('Dashboard period query failed:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load the figures for that period.' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(getPeriod);
