/** COMMERCE layer — pure aggregation helpers for the admin dashboard's charts.
 * Kept separate from the API route so the bucketing/grouping logic is testable
 * without a Supabase client, and separate from lib/commerce/order-status.ts
 * (the status-workflow source of truth) which these helpers build on top of. */
import { ORDER_STATUSES, REVENUE_STATUSES } from './order-status';
import type { OrderStatus } from '@/types/order';

export interface DailyPoint {
  date: string;
  label: string;
  value: number;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

/** Every day key from `days` ago through today (UTC), so charts render a
 * zero-filled line even for days with no orders instead of skipping them. */
function buildDayRange(days: number): string[] {
  const today = new Date();
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

interface OrderForRevenueTrend {
  created_at: string;
  total_amount: number;
  status: OrderStatus;
}

export function revenueByDay(orders: OrderForRevenueTrend[], days: number): DailyPoint[] {
  const totals = new Map<string, number>();
  for (const order of orders) {
    if (!REVENUE_STATUSES.includes(order.status)) continue;
    const key = dayKey(order.created_at);
    totals.set(key, (totals.get(key) || 0) + order.total_amount);
  }
  return buildDayRange(days).map((date) => ({ date, label: dayLabel(date), value: totals.get(date) || 0 }));
}

export function orderCountByDay(orders: { created_at: string }[], days: number): DailyPoint[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    const key = dayKey(order.created_at);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return buildDayRange(days).map((date) => ({ date, label: dayLabel(date), value: counts.get(date) || 0 }));
}

export interface StatusCount {
  status: OrderStatus;
  count: number;
}

/** Zero-fills every canonical status so the chart's category axis is stable
 * regardless of which statuses actually occur in the current data. */
export function groupOrdersByStatus(orders: { status: OrderStatus }[]): StatusCount[] {
  const counts = new Map<OrderStatus, number>();
  for (const order of orders) {
    counts.set(order.status, (counts.get(order.status) || 0) + 1);
  }
  return ORDER_STATUSES.map((status) => ({ status, count: counts.get(status) || 0 }));
}

export interface ProductSales {
  productName: string;
  quantity: number;
  revenue: number;
}

interface OrderItemForSales {
  product_name: string;
  quantity: number;
  price: number;
}

export function topSellingProducts(items: OrderItemForSales[], limit = 8): ProductSales[] {
  const totals = new Map<string, ProductSales>();
  for (const item of items) {
    const existing = totals.get(item.product_name);
    totals.set(item.product_name, {
      productName: item.product_name,
      quantity: (existing?.quantity || 0) + item.quantity,
      revenue: (existing?.revenue || 0) + item.price * item.quantity
    });
  }
  return Array.from(totals.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}
