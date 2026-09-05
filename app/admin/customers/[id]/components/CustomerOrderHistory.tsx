/** ADMIN layer — every order this buyer has ever placed.
 *
 * The whole point of the customer entity. Before it, answering "what did she
 * order last time" meant searching orders by name and hoping the same spelling
 * had been typed twice.
 *
 * Each row links into the orders page filtered to that order number, rather
 * than opening a second copy of the order panel here. One place where an order
 * is worked on; this is a place where orders are read.
 */
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';
import { getStatusColor, formatOrderStatus } from '@/lib/commerce/order-status';
import { asOrderStatus } from '@/lib/commerce/db-narrowing';
import type { CustomerOrder } from '@/types/customer';

export default function CustomerOrderHistory({ orders }: { orders: CustomerOrder[] }) {
  if (orders.length === 0) {
    return (
      <p className="rounded-surface border border-border bg-background-secondary p-4 text-body-sm text-text-secondary">
        This customer has no orders. That happens when their record was created by an abandoned
        cart or a sign-in rather than by a purchase.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {orders.map((order) => {
        const refunded = Number(order.amount_refunded ?? 0);

        return (
          <li key={order.id} className="rounded-surface border border-border bg-surface p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <Link
                href={`/admin/orders?search=${encodeURIComponent(order.order_number)}`}
                className="font-mono text-body-sm font-medium text-primary hover:underline"
              >
                #{order.order_number}
              </Link>

              <span className="text-body-md font-semibold text-text-primary">
                {formatCurrency(order.total_amount)}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-control px-2 py-0.5 text-caption-md font-medium ${getStatusColor(
                  asOrderStatus(order.status)
                )}`}
              >
                {formatOrderStatus(order.status)}
              </span>
              <Badge tone={order.delivery_option === 'pickup' ? 'info' : 'neutral'}>
                {order.delivery_option === 'pickup' ? 'Pickup' : 'Delivery'}
              </Badge>
              {refunded > 0 && (
                <Badge tone="warning">{formatCurrency(refunded)} refunded</Badge>
              )}
              <span className="text-caption-md text-text-secondary">
                {formatDate(order.created_at)}
              </span>
            </div>

            {/* The name and phone as typed on THIS order, not the current
                profile. A number that changed between orders is exactly what
                somebody is looking for when they open this list. */}
            {order.customer_phone && (
              <p className="mt-1 text-caption-md text-text-secondary">
                Ordered as {order.customer_name} · {order.customer_phone}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
