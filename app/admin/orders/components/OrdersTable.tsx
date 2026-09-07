/**
 * ADMIN layer — the orders list as a table, for working through volume.
 *
 * Cards are the right shape for triage: one order, all of its context, room
 * for the status control and the change-request badge. They are the wrong
 * shape for two hundred of them — a card grid cannot be scanned down a column,
 * so "which of today's orders are unpaid" means reading every card.
 *
 * So both exist, and the operator picks (see OrdersViewToggle). This table
 * shows only what a scan needs — and carries the same two actions the card
 * does, so choosing it is not a trade of capability for density: the actions
 * menu opens the details modal (which is where notifying, editing, refunding
 * and the rest already live) and moves the order's status.
 */
'use client';

import { formatOrderStatus } from '@/lib/commerce/order-status';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';
import { Badge } from '@/components/ui';
import type { Order } from '@/types/order';
import { RowCheckbox, SelectAllCheckbox } from '../../components/SelectionCheckbox';
import OrderRowActions from './OrderRowActions';
import type { TableSelection } from '../../hooks/useTableSelection';
import type { SortDirection } from '../../hooks/useListParams';
import {
  actionsCell,
  SortableHeaderRow,
  STICKY_HEAD,
  TABLE_SCROLL,
  ROW_HOVER,
  TH,
  cell,
  numericCell,
  type TableColumn,
  type TableDensity,
} from '../../components/table';
import { statusTone } from './order-status-tone';

/** Module scope, so the reference is stable for useColumnVisibility. */
export const ORDER_COLUMNS: TableColumn[] = [
  // Not hideable: it is the only thing that names the row, and it is the
  // control that opens the order.
  { key: 'order_number', label: 'Order', hideable: false },
  { key: 'customer_name', label: 'Customer', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'payment', label: 'Payment' },
  { key: 'total_amount', label: 'Total', numeric: true, sortable: true },
  { key: 'created_at', label: 'Placed', sortable: true },
  // Never hideable, for the same reason the products table's is not: a row you
  // cannot act on is not a table anybody wants.
  { key: 'actions', label: 'Actions', srOnlyLabel: true, hideable: false, align: 'right' },
];

interface OrdersTableProps {
  orders: Order[];
  selection: TableSelection;
  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;
  density: TableDensity;
  /** The columns still shown, in order — from useColumnVisibility. */
  visibleColumns: TableColumn[];
  /** Keeps each row's cells lined up with the header above them. */
  isVisible: (key: string) => boolean;
  onOpenDetails: (order: Order) => void;
  onUpdateStatus: (order: Order, status: Order['status']) => void;
}

export default function OrdersTable({
  orders,
  selection,
  sort,
  direction,
  onSortChange,
  density,
  visibleColumns,
  isVisible,
  onOpenDetails,
  onUpdateStatus,
}: OrdersTableProps) {
  return (
    <div
      className={`rounded-surface border border-border bg-surface ${TABLE_SCROLL}`}
      tabIndex={0}
      role="region"
      aria-label="Orders table"
    >
      <table className="min-w-full divide-y divide-divider">
        <caption className="sr-only">
          Orders on this page, with who placed them, what they are worth and where they have got to.
        </caption>
        <thead className={STICKY_HEAD}>
          <SortableHeaderRow
            columns={visibleColumns}
            sort={sort}
            direction={direction}
            onSortChange={onSortChange}
            leading={
              <th scope="col" className={`${TH} w-10`}>
                <SelectAllCheckbox
                  checked={selection.allVisibleSelected}
                  indeterminate={selection.someVisibleSelected}
                  onChange={selection.toggleAll}
                  disabled={orders.length === 0}
                />
              </th>
            }
          />
        </thead>

        <tbody className="divide-y divide-divider">
          {orders.map((order) => {
            const selected = selection.isSelected(order.id);
            return (
              <tr key={order.id} className={selected ? 'bg-primary/5 transition-colors' : ROW_HOVER}>
                <td className={cell(density, 'w-10')}>
                  <RowCheckbox
                    checked={selected}
                    onChange={() => selection.toggle(order.id)}
                    rowLabel={`order ${order.order_number}`}
                  />
                </td>

                <td className={cell(density, 'whitespace-nowrap')}>
                  {/* A button, not a row-level click handler: the row also
                      holds a checkbox, and one clickable region containing
                      another is unreachable by keyboard in a sensible order. */}
                  <button
                    type="button"
                    onClick={() => onOpenDetails(order)}
                    className="text-body-sm font-semibold tabular-nums text-primary hover:underline"
                  >
                    {order.order_number}
                    <span className="sr-only">, open details</span>
                  </button>
                  {order.has_pending_change_request && (
                    <Badge tone="warning" className="ml-2">Change requested</Badge>
                  )}
                </td>

                {isVisible('customer_name') && (
                  <td className={cell(density, 'text-body-sm')}>
                    <span className="block font-medium text-text-primary">{order.customer_name}</span>
                    <span className="block text-caption-md text-text-secondary">{order.customer_email}</span>
                  </td>
                )}

                {isVisible('status') && (
                  <td className={cell(density, 'whitespace-nowrap')}>
                    <Badge tone={statusTone(order.status)}>{formatOrderStatus(order.status)}</Badge>
                  </td>
                )}

                {isVisible('payment') && (
                  <td className={cell(density, 'whitespace-nowrap')}>
                    <Badge tone={order.payment_verified ? 'success' : 'warning'}>
                      {order.payment_verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </td>
                )}

                {isVisible('total_amount') && (
                  <td className={numericCell(density, 'whitespace-nowrap text-body-sm font-medium text-text-primary')}>
                    {formatCurrency(order.total_amount)}
                  </td>
                )}

                {isVisible('created_at') && (
                  <td className={cell(density, 'whitespace-nowrap text-caption-md text-text-secondary')}>
                    {formatDate(order.created_at)}
                  </td>
                )}

                <td className={actionsCell(density, 'whitespace-nowrap')}>
                  <OrderRowActions
                    order={order}
                    onOpenDetails={onOpenDetails}
                    onUpdateStatus={onUpdateStatus}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
