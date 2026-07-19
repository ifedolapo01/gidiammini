/** COMMERCE layer — shared order status → UI badge styling/icon mapping for Admin order surfaces. */
import { createElement, type ReactElement } from 'react';
import { CheckCircle, XCircle, Package, Truck, Home } from 'lucide-react';
import type { Order } from '@/types/order';

export function getStatusIcon(status: Order['status']): ReactElement | undefined {
  switch (status) {
    case 'pending': return createElement(Package, { className: 'text-warning' });
    case 'confirmed': return createElement(CheckCircle, { className: 'text-info' });
    case 'shipped': return createElement(Truck, { className: 'text-accent' });
    case 'delivered': return createElement(Home, { className: 'text-success' });
    case 'cancelled': return createElement(XCircle, { className: 'text-destructive' });
  }
}

export function getStatusColor(status: Order['status']): string | undefined {
  switch (status) {
    case 'pending': return 'bg-warning-background text-warning';
    case 'confirmed': return 'bg-info-background text-info';
    case 'shipped': return 'bg-accent/10 text-accent';
    case 'delivered': return 'bg-success-background text-success';
    case 'cancelled': return 'bg-destructive-background text-destructive';
  }
}

/** Statuses selectable from the current one; terminal statuses (delivered/cancelled) cannot be changed. */
export function getStatusOptions(currentStatus: Order['status']): Order['status'][] {
  const allStatuses: Order['status'][] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

  if (currentStatus === 'delivered' || currentStatus === 'cancelled') {
    return [currentStatus];
  }

  return allStatuses;
}
