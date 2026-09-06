/**
 * COMMERCE layer — what a period was worth, and how it compares. Pure.
 *
 * WHAT COUNTS AS REVENUE
 *
 * Money received less money sent back, from orders.amount_paid and
 * amount_refunded — the same definition the "Money Kept" card already uses,
 * and deliberately not the sum of order totals. An order whose transfer never
 * arrived is not revenue, and a figure that says otherwise is the one number
 * on the page that cannot be checked against a bank statement.
 *
 * A PERCENTAGE CHANGE NEEDS A BASE
 *
 * Every delta here can be `null`, and that is the point. A shop's first week
 * has no previous week; a metric that went from 0 to 40 has no percentage
 * change worth printing, because "+∞%" and "+100%" are both lies about a
 * number that simply did not exist before. The UI shows "no comparison" for
 * those rather than inventing one.
 */

import type { OrderStatus } from '@/types/order';
import { REVENUE_STATUSES } from './order-status';

/** One order, as the period query selects it. */
export interface PeriodOrder {
  id: string;
  created_at: string;
  status: OrderStatus | string;
  total_amount: number;
  amount_paid: number | string | null;
  amount_refunded: number | string | null;
  /** Null for a guest who could not be matched to a customer record. */
  customer_id: string | null;
  customer_email: string | null;
}

export interface PeriodMetrics {
  /** Money received less refunded. */
  revenue: number;
  /** Every order placed in the window, cancellations included. */
  orders: number;
  /** Orders that reached a revenue status. */
  paidOrders: number;
  cancelledOrders: number;
  /** Revenue over paid orders. Null when nothing was paid for — an average of
   *  no orders is not zero, it is undefined. */
  averageOrderValue: number | null;
  /** Cancelled over placed, 0-1. Null when nothing was placed. */
  cancellationRate: number | null;
  /** Of the customers who ordered in this window, the share who had ordered
   *  before it. Null when nobody identifiable ordered. */
  repeatCustomerRate: number | null;
  /** How many distinct customers ordered. Context for the rate above: "50%
   *  repeat" over two customers is not a finding. */
  customers: number;
}

/** numeric columns can arrive as strings from PostgREST; a bare read would
 *  turn a sum into string concatenation rather than an error anybody notices. */
function money(value: number | string | null | undefined): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Who a customer is, for the purpose of "have they bought before".
 *
 * customer_id where there is one, falling back to a lower-cased email. A guest
 * checkout may not have a customer row yet, and treating every guest as the
 * same anonymous buyer — or as a brand new one each time — would make the
 * repeat rate meaningless in opposite directions.
 */
function identityOf(order: PeriodOrder): string | null {
  if (order.customer_id) return order.customer_id;
  const email = order.customer_email?.trim().toLowerCase();
  return email || null;
}

export function summarisePeriod(
  orders: PeriodOrder[],
  /** Identities that had ordered at any point before this window opened. */
  priorCustomers: ReadonlySet<string>
): PeriodMetrics {
  let revenue = 0;
  let paidOrders = 0;
  let cancelledOrders = 0;

  const identities = new Set<string>();

  for (const order of orders) {
    // Cancelled orders are left out of revenue entirely: money held against a
    // cancelled order is a refund waiting to happen, not takings.
    if (order.status === 'cancelled') {
      cancelledOrders += 1;
    } else {
      revenue += money(order.amount_paid) - money(order.amount_refunded);
    }

    if (REVENUE_STATUSES.includes(order.status as OrderStatus)) paidOrders += 1;

    const identity = identityOf(order);
    if (identity) identities.add(identity);
  }

  const returning = [...identities].filter((identity) => priorCustomers.has(identity)).length;

  return {
    revenue,
    orders: orders.length,
    paidOrders,
    cancelledOrders,
    averageOrderValue: paidOrders > 0 ? revenue / paidOrders : null,
    cancellationRate: orders.length > 0 ? cancelledOrders / orders.length : null,
    repeatCustomerRate: identities.size > 0 ? returning / identities.size : null,
    customers: identities.size,
  };
}

export interface Delta {
  /** Change as a fraction of the previous value, e.g. 0.12 for +12%. */
  change: number;
  direction: 'up' | 'down' | 'flat';
}

/**
 * The change between two figures, or null when there is nothing to compare.
 *
 * Null when the previous value is zero or absent. Dividing by it would produce
 * an infinity that renders as a confident percentage, and "revenue is up
 * 100%" reads very differently from "this is the first week with any".
 */
export function deltaBetween(
  current: number | null,
  previous: number | null
): Delta | null {
  if (current === null || previous === null || previous === 0) return null;

  const change = (current - previous) / Math.abs(previous);

  return {
    change,
    // A rounding threshold, not an equality test: a 0.3% move is noise, and
    // an arrow that flickers between up and down on noise is an arrow nobody
    // reads.
    direction: Math.abs(change) < 0.005 ? 'flat' : change > 0 ? 'up' : 'down',
  };
}

/** Every delta for a pair of periods, so the UI asks for one thing. */
export function comparePeriods(current: PeriodMetrics, previous: PeriodMetrics) {
  return {
    revenue: deltaBetween(current.revenue, previous.revenue),
    orders: deltaBetween(current.orders, previous.orders),
    averageOrderValue: deltaBetween(current.averageOrderValue, previous.averageOrderValue),
    cancellationRate: deltaBetween(current.cancellationRate, previous.cancellationRate),
    repeatCustomerRate: deltaBetween(current.repeatCustomerRate, previous.repeatCustomerRate),
    customers: deltaBetween(current.customers, previous.customers),
  };
}

export type PeriodDeltas = ReturnType<typeof comparePeriods>;
