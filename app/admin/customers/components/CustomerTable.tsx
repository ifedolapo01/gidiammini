/** ADMIN layer — the buyer list as a table, for screens wide enough for one.
 *
 * Paired with CustomerCard, which renders the same data stacked on narrow
 * screens — the same split TeamTable / TeamMemberCard already uses.
 *
 * The column headings are the sort controls. Sorting a customer list is not a
 * secondary feature: "who has spent the most", "who has not bought since
 * March" and "who cancels" are the three questions the page exists for, and
 * each is a different sort of the same rows.
 *
 * The sort header, the cell classes and the numeric treatment used to be
 * private to this file; they are now components/table/, shared with every
 * other admin table.
 */
'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';
import type { CustomerSummary } from '@/types/customer';
import type { SortDirection } from '../../hooks/useListParams';
import {
  SortableHeaderRow,
  STICKY_HEAD,
  TABLE_SCROLL,
  ROW_HOVER,
  cell,
  numericCell,
  type TableColumn,
  type TableDensity,
} from '../../components/table';

interface CustomerTableProps {
  customers: CustomerSummary[];
  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;
  density: TableDensity;
}

const COLUMNS: TableColumn[] = [
  { key: 'email', label: 'Customer', sortable: true },
  { key: 'orders_total', label: 'Orders', numeric: true, sortable: true },
  { key: 'lifetime_value', label: 'Spend', numeric: true, sortable: true },
  { key: 'net_lifetime_value', label: 'Kept', numeric: true, sortable: true },
  { key: 'last_order_at', label: 'Last seen', sortable: true },
  { key: 'tags', label: 'Tags' },
];

export default function CustomerTable({
  customers,
  sort,
  direction,
  onSortChange,
  density,
}: CustomerTableProps) {
  return (
    <div className={`hidden md:block ${TABLE_SCROLL}`} tabIndex={0} role="region" aria-label="Customers table">
      <table className="min-w-full divide-y divide-divider">
        <caption className="sr-only">
          Everyone who has ordered from this shop, with what they have spent and when they were
          last seen.
        </caption>
        <thead className={STICKY_HEAD}>
          <SortableHeaderRow
            columns={COLUMNS}
            sort={sort}
            direction={direction}
            onSortChange={onSortChange}
          />
        </thead>
        <tbody className="divide-y divide-divider">
          {customers.map((customer) => (
            <tr
              key={customer.customer_id}
              className={`${ROW_HOVER}${customer.is_blocked ? ' opacity-70' : ''}`}
            >
              <td className={cell(density)}>
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

              <td className={numericCell(density, 'text-body-sm text-text-primary')}>
                {customer.orders_total ?? 0}
                {(customer.orders_cancelled ?? 0) > 0 && (
                  <span className="block text-caption-md text-warning">
                    {customer.orders_cancelled} cancelled
                  </span>
                )}
              </td>

              <td className={numericCell(density, 'text-body-sm font-medium text-text-primary')}>
                {formatCurrency(Number(customer.lifetime_value ?? 0))}
              </td>

              {/* Gross and net side by side. A buyer who orders constantly and
                  sends half of it back is a very different person from one who
                  does not, and one column cannot show that. */}
              <td className={numericCell(density, 'text-body-sm text-text-secondary')}>
                {formatCurrency(Number(customer.net_lifetime_value ?? 0))}
              </td>

              <td className={cell(density, 'whitespace-nowrap text-caption-md text-text-secondary')}>
                {customer.last_order_at ? formatDate(customer.last_order_at) : 'Never ordered'}
              </td>

              <td className={cell(density)}>
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
