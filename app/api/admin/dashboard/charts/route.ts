// app/api/admin/dashboard/charts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import {
  revenueByDay,
  orderCountByDay,
  groupOrdersByStatus,
  topSellingProducts
} from '@/lib/commerce/dashboard-analytics';

const VALID_RANGES = [7, 30, 90] as const;
type Range = (typeof VALID_RANGES)[number];

function parseRange(value: string | null): Range {
  const parsed = Number(value);
  return (VALID_RANGES as readonly number[]).includes(parsed) ? (parsed as Range) : 30;
}

async function getDashboardCharts(supabase: SupabaseClient, request: NextRequest) {
  const range = parseRange(new URL(request.url).searchParams.get('range'));

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - (range - 1));
  cutoff.setUTCHours(0, 0, 0, 0);

  const { data: trendOrders } = await supabase
    .from('orders')
    .select('created_at, total_amount, status')
    .gte('created_at', cutoff.toISOString());

  const { data: allOrders } = await supabase
    .from('orders')
    .select('status, order_items (product_name, quantity, price)');

  const nonCancelledItems = (allOrders || [])
    .filter((order) => order.status !== 'cancelled')
    .flatMap((order) => order.order_items || []);

  return NextResponse.json({
    revenueTrend: revenueByDay(trendOrders || [], range),
    orderTrend: orderCountByDay(trendOrders || [], range),
    statusBreakdown: groupOrdersByStatus(allOrders || []),
    topProducts: topSellingProducts(nonCancelledItems)
  });
}

export const GET = withAdminAuth((request, { supabase }) => getDashboardCharts(supabase, request));
