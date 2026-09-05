/** ADMIN layer — the buyer list as a table, for screens wide enough for one.
 *
 * Paired with CustomerCard, which renders the same data stacked on narrow
 * screens — the same split TeamTable / TeamMemberCard already uses.
 *
 * The column headings are the sort controls. Sorting a customer list is not a
 * secondary feature: "who has spent the most", "who has not bought since
 * March" and "who cancels" are the three questions the page exists for, and
 * each is a different sort of the same rows.
 */
'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';
import type { CustomerSummary } from '@/types/customer';
import type { SortDirection } from '../../hooks/useListParams';

const TH = 'px-4 py-3 text-left text-caption-md font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap';
const TD = 'px-4 py-3 align-middle';

interface CustomerTableProps {
  customers: CustomerSummary[];
  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;
}

const COLUMNS: Array<{ key: string; label: string; numeric?: boolean; sortable?: boolean }> = [
  { key: 'email', label: 'Customer', sortable: true },
  { key: 'orders_total', label: 'Orders', numeric: true, sortable: true },
  { key: 'lifetime_value', label: 'Spend', numeric: true, sortable: true },
  { key: 'net_lifetime_value', label: 'Kept', numeric: true, sortable: true },
  { key: 'last_order_at', label: 'Last seen', sortable: true },
  { key: 'tags', label: 'Tags' },
];

function SortButton({
  column,
  sort,
  direction,
  onSortChange,
}: {
  column: { key: string; label: string };
  sort: string;
  direction: SortDirection;
  onSortChange: CustomerTableProps['onSortChange'];
}) {
  const active = sort === column.key;
  // A new column starts on the answer somebody actually wants: biggest spend,
  // most orders, most recent. Only re-clicking the active column reverses it.
  const next: SortDirection = active && direction === 'desc' ? 'asc' : 'desc';

  return (
    <button
      type="button"
      onClick={() => onSortChange(column.key, next)}
      className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-text-primary"
      aria-label={`Sort by ${column.label}, ${next === 'asc' ? 'ascending' : 'descending'}`}
    >
      {column.label}
      {active &&
        (direction === 'asc' ? (
          <ArrowUp className="size-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="size-3" aria-hidden="true" />
        ))}
    </button>
  );
}

export default function CustomerTable({ customers, sort, direction, onSortChange }: CustomerTableProps) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full divide-y divide-divider">
        <caption className="sr-only">
          Everyone who has ordered from this shop, with what they have spent and when they were
          last seen.
        </caption>
        <thead className="bg-background-secondary">
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`${TH}${column.numeric ? ' text-right' : ''}`}
                aria-sort={
                  sort === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
                }
              >
                {column.sortable ? (
                  <SortButton
                    column={column}
                    sort={sort}
                    direction={direction}
                    onSortChange={onSortChange}
                  />
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {customers.map((customer) => (
            <tr key={customer.customer_id} className={customer.is_blocked ? 'opacity-70' : undefined}>
              <td className={TD}>
                <Link
                  href={`/admin/customers/${customer.customer_id}`}
                  className="block text-body-sm font-medium text-primary hover:underline"
                >
                  {customer.full_name || customer.email}
                </Link>
                {customer.full_name && (
                  <span className="block text-caption-md text-text-secondary">{customer.email}</span>
                )}
                {customer.is_blocked && (
                  <Badge tone="destructive" className="mt-1">Blocked</Badge>
                )}
              </td>

              <td className={`${TD} text-right text-body-sm text-text-primary`}>
                {customer.orders_total ?? 0}
                {(customer.orders_cancelled ?? 0) > 0 && (
                  <span className="block text-caption-md text-warning">
                    {customer.orders_cancelled} cancelled
                  </span>
                )}
              </td>

              <td className={`${TD} text-right text-body-sm font-medium text-text-primary`}>
                {formatCurrency(Number(customer.lifetime_value ?? 0))}
              </td>

              {/* Gross and net side by side. A buyer who orders constantly and
                  sends half of it back is a very different person from one who
                  does not, and one column cannot show that. */}
              <td className={`${TD} text-right text-body-sm text-text-secondary`}>
                {formatCurrency(Number(customer.net_lifetime_value ?? 0))}
              </td>

              <td className={`${TD} whitespace-nowrap text-caption-md text-text-secondary`}>
                {customer.last_order_at ? formatDate(customer.last_order_at) : 'Never ordered'}
              </td>

              <td className={TD}>
                <span className="flex flex-wrap gap-1">
                  {(customer.tags ?? []).map((tag) => (
                    <Badge key={tag} tone="neutral">{tag}</Badge>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
