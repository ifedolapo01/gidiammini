/** STOREFRONT layer — one order card, with tracking a click away.
 *
 * Split out of AccountOrderList so the list stays a plain map and each row
 * owns its own expand state — opening one order's tracking must never affect
 * any other row.
 */
'use client';

import { useState } from 'react';
import { ChevronDown, MapPinned } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDateOnly } from '@/lib/commerce/format-date';
import { capitalizeText } from '@/lib/commerce/format-text';
import { formatCustomerStatusLabel } from '@/lib/commerce/order-status';
import { cn } from '@/lib/utils';
import type { AccountOrder } from '@/lib/commerce/account-query';
import { ReorderButton } from './ReorderButton';
import OrderTrackingPanel from './OrderTrackingPanel';

/** Terminal-ish statuses read as good news; a cancellation does not. */
function toneFor(status: string): 'success' | 'destructive' | 'warning' | 'info' {
  if (status === 'cancelled') return 'destructive';
  if (status === 'delivered' || status === 'picked_up') return 'success';
  if (status === 'pending') return 'warning';
  return 'info';
}

interface AccountOrderRowProps {
  order: AccountOrder;
  customerEmail: string;
}

export function AccountOrderRow({ order, customerEmail }: AccountOrderRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-surface border border-border bg-surface shadow-elevation-1 transition-shadow hover:shadow-elevation-2">
      <div className="p-4">
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

        <ul className="mt-3 space-y-1 rounded-control bg-background-secondary p-3 text-body-sm text-text-secondary">
          {order.order_items.map((line, index) => (
            <li key={`${order.id}-${index}`}>
              {line.quantity} × {line.product_name}
              {(line.size || line.color) && (
                <span className="text-text-muted">
                  {' '}
                  ({[line.size, capitalizeText(line.color)].filter(Boolean).join(', ')})
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-light pt-3">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 text-body-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <MapPinned className="h-4 w-4" aria-hidden="true" />
            {expanded ? 'Hide tracking' : 'Track this order'}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          <ReorderButton orderId={order.id} orderNumber={order.order_number} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-background-secondary p-4">
          <OrderTrackingPanel orderNumber={order.order_number} contact={customerEmail} />
        </div>
      )}
    </li>
  );
}
