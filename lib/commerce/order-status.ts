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

/** Generic "snake_case or lowercase" -> "Title Case" formatter — reusable for
 * any status string, so adding a new status never requires a new label entry. */
export function formatOrderStatus(status: string): string {
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
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
