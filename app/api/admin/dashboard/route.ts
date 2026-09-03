// app/api/admin/dashboard/route.ts
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { REVENUE_STATUSES } from '@/lib/commerce/order-status';
import { marginTotals } from '@/lib/commerce/margin';

async function getDashboardStats(supabase: SupabaseClient) {
  try {
    // Fetch total products count
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Fetch total orders count
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    // Fetch pending orders count
    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Fetch total revenue from completed/delivered orders
    const { data: revenueOrders } = await supabase
      .from('orders')
      .select('total_amount, status')
      .in('status', REVENUE_STATUSES);

    const totalRevenue = revenueOrders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

    // Gross margin, from what was actually sold rather than from the order
    // totals: order_items carries the price paid per line and points at the
    // variant it sold, and the variant carries the cost. Revenue-only figures
    // make a high-turnover, low-margin line look like the best seller.
    //
    // Cost is optional, so marginTotals() also reports how much of this
    // revenue had a cost at all — a margin computed over a third of the
    // catalogue must not be read as the whole picture.
    const { data: soldLines } = await supabase
      .from('order_items')
      .select('price, quantity, orders!inner(status), product_variants(cost)')
      .in('orders.status', REVENUE_STATUSES);

    const margin = marginTotals(
      (soldLines ?? []).map((line: any) => ({
        price: line.price,
        quantity: line.quantity,
        cost: typeof line.product_variants?.cost === 'number' ? line.product_variants.cost : null,
      }))
    );

    // Fetch recent orders (last 5)
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch low stock products (stock > 0 AND <= 10)
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .gt('stock', 0)  // Only products with stock > 0
      .lte('stock', 10)
      .order('stock', { ascending: true })
      .limit(5);

    // Fetch out of stock products
    const { data: outOfStockProducts } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .lte('stock', 0)  // Products with 0 or negative stock
      .limit(5);

    return NextResponse.json({
      totalProducts: totalProducts || 0,
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      totalRevenue,
      margin,
      recentOrders: recentOrders || [],
      lowStockProducts: lowStockProducts || [],
      outOfStockProducts: outOfStockProducts || []
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard statistics',
        totalProducts: 0,
        totalOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        margin: null,
        recentOrders: [],
        lowStockProducts: [],
        outOfStockProducts: []
      },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth((_request, { supabase }) => getDashboardStats(supabase));
