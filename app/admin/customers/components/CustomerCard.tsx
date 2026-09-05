/** ADMIN layer — one buyer, stacked, for narrow screens.
 *
 * The same data CustomerTable shows in columns. Two renderings rather than a
 * table that scrolls sideways, because the figure somebody is scanning for on
 * a phone — what this person has spent — should not be off the right edge.
 */
'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';
import type { CustomerSummary } from '@/types/customer';

export default function CustomerCard({ customer }: { customer: CustomerSummary }) {
  return (
    <Link
      href={`/admin/customers/${customer.customer_id}`}
      className="block rounded-surface border border-border bg-surface p-4 transition-shadow hover:shadow-elevation-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">
            {customer.full_name || customer.email}
          </p>
          {customer.full_name && (
            <p className="truncate text-caption-md text-text-secondary">{customer.email}</p>
          )}
        </div>
        <p className="shrink-0 text-body-md font-bold text-text-primary">
          {formatCurrency(Number(customer.lifetime_value ?? 0))}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption-md text-text-secondary">
        <span>{customer.orders_total ?? 0} order{(customer.orders_total ?? 0) === 1 ? '' : 's'}</span>
        {(customer.orders_cancelled ?? 0) > 0 && (
          <span className="text-warning">{customer.orders_cancelled} cancelled</span>
        )}
        <span>
          {customer.last_order_at ? `Last seen ${formatDate(customer.last_order_at)}` : 'Never ordered'}
        </span>
      </div>

      {(customer.is_blocked || (customer.tags?.length ?? 0) > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {customer.is_blocked && <Badge tone="destructive">Blocked</Badge>}
          {(customer.tags ?? []).map((tag) => (
            <Badge key={tag} tone="neutral">{tag}</Badge>
          ))}
        </div>
      )}
    </Link>
  );
}
