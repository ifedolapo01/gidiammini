/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The order history, newest first.
//
// A client component only because of the reorder button. The data arrives as a
// prop from the server page, so the list itself is in the HTML — a customer on
// a slow connection sees their orders before any JavaScript runs.
//
// Statuses use the customer-facing labels, not the admin's: 'pending' here
// means "we are checking your transfer", and the admin's word for it would
// read as "you still have to pay".
'use client';

import { Package } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDateOnly } from '@/lib/commerce/format-date';
import { formatCustomerStatusLabel } from '@/lib/commerce/order-status';
import type { OrderStatus } from '@/types/order';
import type { AccountOrder } from '@/lib/commerce/account-query';
import { ReorderButton } from './ReorderButton';

/** Terminal-ish statuses read as good news; a cancellation does not. */
function toneFor(status: string): 'success' | 'destructive' | 'warning' | 'info' {
  if (status === 'cancelled') return 'destructive';
  if (status === 'delivered' || status === 'picked_up') return 'success';
  if (status === 'pending') return 'warning';
  return 'info';
}


interface AccountOrderListProps {
  orders: AccountOrder[];
}

export function AccountOrderList({ orders }: AccountOrderListProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-surface border border-dashed border-border bg-surface p-8 text-center">
        <Package className="mx-auto h-8 w-8 text-text-muted" aria-hidden="true" />
        <p className="mt-3 text-body-md font-medium text-text-primary">No orders on this account yet</p>
        <p className="mt-1 text-body-sm text-text-secondary">
          Anything you order with this email address will appear here.
        </p>
        <Link
          href="/products"
          className="mt-4 inline-flex text-body-md font-medium text-primary underline-offset-4 hover:underline"
        >
          Browse the collection →
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((order) => (
        <li key={order.id} className="rounded-surface border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-body-md font-semibold text-text-primary">#{order.order_number}</p>
              <p className="text-caption-md text-text-secondary">
                <time dateTime={order.created_at}>{formatDateOnly(order.created_at)}</time>
                {' · '}
                {formatCurrency(order.total_amount)}
                {order.delivery_option === 'pickup' ? ' · Pickup' : ''}
              </p>
            </div>
            <Badge tone={toneFor(order.status)}>{formatCustomerStatusLabel(order.status)}</Badge>
          </div>

          <ul className="mt-3 space-y-1 text-body-sm text-text-secondary">
            {order.order_items.map((line, index) => (
              <li key={`${order.id}-${index}`}>
                {line.quantity} × {line.product_name}
                {(line.size || line.color) && (
                  <span className="text-text-muted">
                    {' '}
                    ({[line.size, line.color].filter(Boolean).join(', ')})
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-3">
            <ReorderButton orderId={order.id} orderNumber={order.order_number} />
          </div>
        </li>
      ))}
    </ul>
  );
}
