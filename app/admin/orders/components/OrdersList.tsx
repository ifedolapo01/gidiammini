/**
 * ADMIN layer — one page of orders, in whichever layout is selected, plus its
 * pagination.
 *
 * Extracted from page.tsx, which had grown past the file-size limit holding
 * this alongside the header, the filters, the bulk bar and three dialogs. The
 * choice between the two layouts is one concern and it lives here; the page
 * keeps the state and the handlers.
 */
'use client';

import OrderCard from './OrderCard';
import OrdersTable from './OrdersTable';
import TablePagination from '../../components/TablePagination';
import type { Order } from '@/types/order';
import type { TableSelection } from '../../hooks/useTableSelection';
import type { ListMeta } from '../../hooks/useListData';
import type { SortDirection } from '../../hooks/useListParams';
import type { TableDensity } from '../../components/table';
import type { OrdersView } from './OrdersViewToggle';
import type { ShippingZone } from '@/types/shipping';

interface OrdersListProps {
  orders: Order[];
  view: OrdersView;
  density: TableDensity;
  selection: TableSelection;
  shippingZones: ShippingZone[];
  loading: boolean;
  meta: ListMeta;
  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;
  onPageChange: (page: number) => void;
  limit: number;
  onLimitChange: (limit: number) => void;
  onOpenDetails: (order: Order) => void;
  onUpdateStatus: (order: Order, status: Order['status']) => void;
}

export default function OrdersList({
  orders,
  view,
  density,
  selection,
  shippingZones,
  loading,
  meta,
  sort,
  direction,
  onSortChange,
  onPageChange,
  limit,
  onLimitChange,
  onOpenDetails,
  onUpdateStatus,
}: OrdersListProps) {
  const tableView = view === 'table';

  return (
    <>
      {/* The table is md-and-up only; below that the cards render regardless of
          the stored preference, because the table needs width a phone has not
          got. Hence the pair of responsive classes rather than one branch. */}
      {tableView && (
        <div className="hidden md:block" aria-busy={loading}>
          <OrdersTable
            orders={orders}
            selection={selection}
            sort={sort}
            direction={direction}
            onSortChange={onSortChange}
            density={density}
            onOpenDetails={onOpenDetails}
          />
        </div>
      )}

      <div className={`grid gap-4 md:gap-6${tableView ? ' md:hidden' : ''}`} aria-busy={loading}>
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            shippingZones={shippingZones}
            selected={selection.isSelected(order.id)}
            onToggleSelect={selection.toggle}
            onOpenDetails={onOpenDetails}
            onUpdateStatus={onUpdateStatus}
          />
        ))}
      </div>

      <div className="mt-4 rounded-surface border border-border bg-surface">
        <TablePagination
          page={meta.page}
          pageCount={meta.totalPages}
          total={meta.total}
          loading={loading}
          onPageChange={onPageChange}
          limit={limit}
          onLimitChange={onLimitChange}
          itemNoun="orders"
          label="Order pages"
        />
      </div>
    </>
  );
}
