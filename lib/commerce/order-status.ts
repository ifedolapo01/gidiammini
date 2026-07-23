/** COMMERCE layer — single source of truth for the order status workflow:
 * the canonical ordered list, display formatting, badge icon/color, valid
 * next-status options, and which statuses imply stock has been reserved.
 * Shared by Admin order surfaces and the customer-facing order tracker. */
import { createElement, type ReactElement } from 'react';
import { CheckCircle, XCircle, Package, Truck, Home, CalendarClock, Store, PackageCheck } from 'lucide-react';
import type { OrderStatus } from '@/types/order';

/** Canonical order, also used to populate every status dropdown/filter. */
export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'rescheduled',
  'shipped',
  'ready_for_pickup',
  'picked_up',
  'delivered',
  'cancelled',
];

export const INITIAL_ORDER_STATUS: OrderStatus = 'pending';

/** Every status except 'pending' (not yet confirmed) and 'cancelled' (never fulfilled) counts toward revenue. */
export const REVENUE_STATUSES: OrderStatus[] = ORDER_STATUSES.filter(
  (status) => status !== 'pending' && status !== 'cancelled'
);

/** Generic "snake_case or lowercase" -> "Title Case" formatter — reusable for
 * any status string, so adding a new status never requires a new label entry. */
export function formatOrderStatus(status: string): string {
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Customer-facing label for a status, where the bare admin term could be
 * misread. By the time a customer can see an order at all, they've already
 * uploaded their payment receipt (checkout only creates the order once a
 * receipt is attached) — so 'pending' means "we're verifying your payment,"
 * never "you still need to pay." Admin surfaces should keep formatOrderStatus,
 * since for them 'pending' correctly means "needs your review." */
export function formatCustomerStatusLabel(status: string): string {
  if (status === 'pending') return 'Payment Verification Pending';
  return formatOrderStatus(status);
}

export function getStatusIcon(status: OrderStatus): ReactElement | undefined {
  switch (status) {
    case 'pending': return createElement(Package, { className: 'text-warning' });
    case 'confirmed': return createElement(CheckCircle, { className: 'text-info' });
    case 'rescheduled': return createElement(CalendarClock, { className: 'text-warning' });
    case 'shipped': return createElement(Truck, { className: 'text-accent' });
    case 'ready_for_pickup': return createElement(Store, { className: 'text-accent' });
    case 'picked_up': return createElement(PackageCheck, { className: 'text-success' });
    case 'delivered': return createElement(Home, { className: 'text-success' });
    case 'cancelled': return createElement(XCircle, { className: 'text-destructive' });
  }
}

/** Every status maps to a distinct (hue, intensity) pair so no two statuses
 * ever render identically, while related stages (e.g. picked_up/delivered)
 * still share a hue family to signal they're the same kind of outcome. */
export function getStatusColor(status: OrderStatus): string {
  switch (status) {
    case 'pending': return 'bg-warning-background text-warning';
    case 'confirmed': return 'bg-info-background text-info';
    case 'rescheduled': return 'bg-warning text-text-inverse';
    case 'shipped': return 'bg-accent/10 text-accent';
    case 'ready_for_pickup': return 'bg-accent text-accent-foreground';
    case 'picked_up': return 'bg-success-background text-success';
    case 'delivered': return 'bg-success text-text-inverse';
    case 'cancelled': return 'bg-destructive-background text-destructive';
  }
}

export type StatusColorToken = 'warning' | 'info' | 'accent' | 'success' | 'destructive';

/** Raw semantic-token name behind each status's hue, for contexts (e.g. chart fills) that
 * need a CSS custom-property lookup rather than a Tailwind class string like getStatusColor. */
export function getStatusColorToken(status: OrderStatus): StatusColorToken {
  switch (status) {
    case 'pending':
    case 'rescheduled':
      return 'warning';
    case 'confirmed':
      return 'info';
    case 'shipped':
    case 'ready_for_pickup':
      return 'accent';
    case 'picked_up':
    case 'delivered':
      return 'success';
    case 'cancelled':
      return 'destructive';
  }
}

/** Statuses selectable from the current one; terminal statuses (delivered/cancelled) cannot be changed. */
export function getStatusOptions(currentStatus: OrderStatus): OrderStatus[] {
  if (currentStatus === 'delivered' || currentStatus === 'cancelled') {
    return [currentStatus];
  }

  return ORDER_STATUSES;
}

/** True once an order has ever moved past 'pending' (stock is decremented the
 * first time this becomes true, and restored if such an order is cancelled). */
export function hasStockReserved(status: OrderStatus): boolean {
  return status !== 'pending' && status !== 'cancelled';
}

const TERMINAL_FOR_CHANGE_REQUESTS: OrderStatus[] = ['delivered', 'picked_up', 'cancelled'];

/** Whether a customer can request a reschedule/delivery-method change from
 * this status. Deliberately permissive otherwise — the seller's approve/
 * reject decision is the real "is it too late" judgment call, not this check. */
export function canRequestOrderChange(status: OrderStatus): boolean {
  return !TERMINAL_FOR_CHANGE_REQUESTS.includes(status);
}
