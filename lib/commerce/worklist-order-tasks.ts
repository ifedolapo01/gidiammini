/**
 * COMMERCE layer (server only) — the orders behind a worklist count.
 *
 * One resolver per kind of work. Each answers the same question in its own
 * terms: which specific orders is this number made of, and where does somebody
 * go to deal with each one.
 *
 * Every resolver takes a limit and reports whether it hit it. A dashboard row
 * that quietly shows five of nineteen is worse than one that says so — the
 * whole point of the panel is that the numbers can be trusted.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorklistEntry, WorklistResult } from '@/types/worklist';
import { findOverdueOrders } from './overdue-orders';
import { daysWaiting, settlement } from './payment-outcome';
import { formatCurrency } from './pricing';

const ORDER_COLUMNS =
  'id, order_number, customer_name, total_amount, amount_paid, created_at, receipt_path';

interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  total_amount: number;
  amount_paid: number;
  created_at: string;
  receipt_path: string | null;
}

/** "Waiting 3 days", or nothing at all on the day it arrived. */
function waited(since: string): string | null {
  const days = daysWaiting(since);
  if (days === 0) return null;
  return `waiting ${days} day${days === 1 ? '' : 's'}`;
}

/** Receipts uploaded against unpaid orders — the verification queue's front. */
export async function receiptsToVerify(
  supabase: SupabaseClient,
  limit: number
): Promise<WorklistResult> {
  const { data } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('payment_verified', false)
    .eq('status', 'pending')
    .not('receipt_path', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit + 1);

  const rows = ((data ?? []) as unknown as OrderRow[]).slice(0, limit);

  return {
    task: 'receipts',
    truncated: (data ?? []).length > limit,
    entries: rows.map((order): WorklistEntry => ({
      id: order.id,
      title: order.customer_name,
      subtitle: order.order_number,
      meta: waited(order.created_at),
      amount: order.total_amount,
      // Straight into the queue with this one open, so the row is not just an
      // announcement of work somewhere else.
      href: `/admin/payments?order=${order.id}`,
    })),
  };
}

/** Orders holding money that does not cover them — a balance to chase. */
export async function partPaidOrders(
  supabase: SupabaseClient,
  limit: number
): Promise<WorklistResult> {
  const { data } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('payment_verified', false)
    .neq('status', 'cancelled')
    .gt('amount_paid', 0)
    .order('created_at', { ascending: true })
    .limit(limit + 1);

  const rows = ((data ?? []) as unknown as OrderRow[]).slice(0, limit);

  return {
    task: 'part-paid',
    truncated: (data ?? []).length > limit,
    entries: rows.map((order): WorklistEntry => {
      const balance = settlement(order.total_amount, order.amount_paid);

      return {
        id: order.id,
        title: order.customer_name,
        subtitle: order.order_number,
        meta: `${waited(order.created_at) ?? 'today'} · paid ${formatCurrency(order.amount_paid)}`,
        // The balance, not the total: that is the figure this row is about.
        amount: balance.outstanding,
        href: `/admin/payments?order=${order.id}`,
      };
    }),
  };
}

/**
 * Confirmed orders past their zone's delivery window.
 *
 * The rule cannot be a WHERE clause — see findOverdueOrders — so this reuses
 * that resolver rather than reimplementing "late", which the alerts ticker and
 * the orders list's Overdue filter also share.
 */
export async function overdueShipments(
  supabase: SupabaseClient,
  limit: number
): Promise<WorklistResult> {
  const overdue = await findOverdueOrders(supabase);

  return {
    task: 'overdue-shipping',
    truncated: overdue.length > limit,
    entries: overdue.slice(0, limit).map((order): WorklistEntry => ({
      id: order.id,
      title: order.customer_name,
      subtitle: order.order_number,
      meta: `${Math.round(order.hoursOverdue)}h past the window`,
      href: `/admin/orders?filter=overdue`,
      // The one inline action worth having: nothing about "this went out" needs
      // a figure or a reason, and the alternative is four taps to a dropdown.
      action: 'ship',
    })),
  };
}

/** Unpaid orders with nothing to verify yet — the ones to chase, not work. */
export async function ordersAwaitingPayment(
  supabase: SupabaseClient,
  limit: number
): Promise<WorklistResult> {
  const { data } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('status', 'pending')
    .eq('payment_verified', false)
    .is('receipt_path', null)
    .order('created_at', { ascending: true })
    .limit(limit + 1);

  const rows = ((data ?? []) as unknown as OrderRow[]).slice(0, limit);

  return {
    task: 'pending-orders',
    truncated: (data ?? []).length > limit,
    entries: rows.map((order): WorklistEntry => ({
      id: order.id,
      title: order.customer_name,
      subtitle: order.order_number,
      meta: waited(order.created_at) ?? 'placed today',
      amount: order.total_amount,
      href: `/admin/orders?search=${encodeURIComponent(order.order_number)}`,
    })),
  };
}

/** Reschedules and delivery-method changes a customer has asked for. */
export async function changeRequests(
  supabase: SupabaseClient,
  limit: number
): Promise<WorklistResult> {
  const { data } = await supabase
    .from('order_change_requests')
    .select('id, type, created_at, orders (id, order_number, customer_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit + 1);

  const rows = (data ?? []).slice(0, limit);

  return {
    task: 'change-requests',
    truncated: (data ?? []).length > limit,
    entries: rows.map((request: any): WorklistEntry => ({
      id: request.id,
      title: request.orders?.customer_name ?? 'Unknown customer',
      subtitle: `${request.orders?.order_number ?? '—'} · ${String(request.type).replace(/_/g, ' ')}`,
      meta: waited(request.created_at),
      href: `/admin/orders?search=${encodeURIComponent(request.orders?.order_number ?? '')}`,
    })),
  };
}
