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

    // Revenue is money received, not orders placed.
    //
    // It used to be the sum of every non-cancelled order's total, which
    // counted the full value of orders whose transfer never arrived or arrived
    // short — the figure a shopkeeper checks against their bank was the one
    // number on this page that could not be checked against anything.
    // orders.amount_paid is the trigger-maintained sum of that order's
    // non-rejected payments (migration 20260905180000), so this is one pass
    // over the same rows and gives the outstanding balance for free.
    //
    // Cancelled orders are left out of both figures. Money received against a
    // cancelled order is a refund waiting to happen, not revenue, and its
    // balance is not owed to the shop.
    //
    // Refunds come off. Money that arrived and then went back out again is not
    // revenue by any definition a shopkeeper would accept, and a refund
    // feature that leaves the headline figure untouched is worse than no
    // refund feature — it makes the number quietly wrong rather than obviously
    // missing. amount_refunded is the trigger-maintained sum of that order's
    // completed refunds (migration 20260905190200); a refund that has been
    // agreed but not sent is deliberately not deducted, because the money is
    // still in the account.
    const { data: paymentRows } = await supabase
      .from('orders')
      .select('total_amount, amount_paid, amount_refunded, status')
      .neq('status', 'cancelled');

    // Number() rather than a bare read: amount_paid is a Postgres `numeric`,
    // and a numeric that ever arrives as a string would turn this sum into
    // string concatenation rather than an error anybody would notice.
    const paid = (order: { amount_paid: number | null }) => Number(order.amount_paid ?? 0);
    const refunded = (order: { amount_refunded: number | null }) => Number(order.amount_refunded ?? 0);

    const totalRefunded = paymentRows?.reduce((sum, order) => sum + refunded(order), 0) || 0;
    const totalRevenue =
      (paymentRows?.reduce((sum, order) => sum + paid(order), 0) || 0) - totalRefunded;

    // What customers still owe on orders the shop intends to fulfil. The
    // counterpart to revenue: together they are the value of every live order.
    // Refunds count against what has been received here too: an order that was
    // paid and then partly refunded genuinely does owe that money again if it
    // is still being fulfilled.
    const outstanding =
      paymentRows?.reduce(
        (sum, order) => sum + Math.max(0, order.total_amount - (paid(order) - refunded(order))),
        0
      ) || 0;

    // Orders with money against them that does not cover the total. These are
    // a balance to chase rather than a receipt to verify, which is why the
    // verification queue counts them separately too.
    const partPaidOrders =
      paymentRows?.filter((order) => paid(order) > 0 && paid(order) < order.total_amount).length || 0;

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
      totalRefunded,
      outstanding,
      partPaidOrders,
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
        totalRefunded: 0,
        outstanding: 0,
        partPaidOrders: 0,
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
