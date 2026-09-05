/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/page.tsx
//
// The page is now a view over one server-selected page of orders: the filter,
// search and sort controls write query parameters, and the counts come from
// the summary endpoint rather than from reducing an array the browser had to
// hold in full.
'use client';
import { OrdersSkeleton } from './components/OrdersSkeleton';

import { Suspense } from 'react';
import { Package } from 'lucide-react';
import OrderDetailsModal from './components/OrderDetailsModal';
import OrderCard from './components/OrderCard';
import OrderFilters from './components/OrderFilters';
import OrderStatsSummary from './components/OrderStatsSummary';
import OrdersBulkBar from './components/OrdersBulkBar';
import TablePagination from '../components/TablePagination';
import LiveIndicator from '../components/LiveIndicator';
import BulkResultSummary from '../components/BulkResultSummary';
import ExportButton from '../components/ExportButton';
import { useTableSelection } from '../hooks/useTableSelection';
import { useOrders } from './hooks/useOrders';
import { useShippingZoneOptions } from './hooks/useShippingZoneOptions';

function AdminOrdersContent() {
  const {
    params,
    orders,
    meta,
    loading,
    error,
    summary,
    live,
    updateOrderStatus,
    bulk,
    selectedOrder,
    openOrderDetails,
    closeOrderDetails,
    sendingNotification,
    sendCustomNotification,
    notificationMessage,
    setNotificationMessage,
    updateOrderShipping,
    updatingShipping,
    resolveChangeRequest,
    resolvingRequestId,
  } = useOrders();

  const { zones: shippingZones } = useShippingZoneOptions();
  const selection = useTableSelection(orders.map((order) => order.id));
  const selectedOrders = orders.filter((order) => selection.isSelected(order.id));

  if (loading && orders.length === 0) return <OrdersSkeleton />;

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-h4 md:text-h3 font-bold text-text-primary">Manage Orders</h1>
            <p className="flex items-center gap-3 text-text-secondary mt-1" aria-live="polite">
              <span>{meta.total} order{meta.total !== 1 ? 's' : ''} found</span>
              <LiveIndicator live={live} subject="orders" />
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            {/* Line items flattened, one row each — the shape an accountant
                can pivot. */}
            <ExportButton dataset="orders" label="Export orders" />
          </div>
        </div>

        <OrderFilters
          searchTerm={params.search}
          onSearchTermChange={params.setSearch}
          filter={params.filters.status ?? 'all'}
          onFilterChange={(value) => params.setFilter('status', value)}
          overdueCount={summary?.overdue ?? 0}
          sort={params.sort}
          direction={params.direction}
          onSortChange={params.setSort}
        />

        {error && (
          <div className="mb-6 p-4 bg-destructive-background border border-destructive-border rounded-control">
            <p className="text-destructive font-medium">Error: {error}</p>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-surface rounded-surface shadow-elevation-1 border border-border p-8 md:p-12 text-center">
            <Package className="w-16 h-16 text-text-muted mx-auto mb-4" />
            <h3 className="text-h5 font-semibold text-text-primary mb-2">
              {params.search ? 'No orders found' : 'No orders yet'}
            </h3>
            <p className="text-text-secondary">
              {params.search
                ? 'Try a different search term'
                : 'Orders will appear here when customers place them'
              }
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:gap-6" aria-busy={loading}>
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  shippingZones={shippingZones}
                  selected={selection.isSelected(order.id)}
                  onToggleSelect={selection.toggle}
                  onOpenDetails={openOrderDetails}
                  onUpdateStatus={updateOrderStatus}
                />
              ))}
            </div>

            <div className="mt-4 bg-surface rounded-surface border border-border">
              <TablePagination
                page={meta.page}
                pageCount={meta.totalPages}
                total={meta.total}
                loading={loading}
                onPageChange={params.setPage}
                limit={params.limit}
                onLimitChange={params.setLimit}
                itemNoun="orders"
                label="Order pages"
              />
            </div>
          </>
        )}

        <BulkResultSummary outcome={bulk.outcome} onDismiss={bulk.dismissOutcome} />

        <OrderStatsSummary summary={summary} />

        <OrdersBulkBar
          selectedOrders={selectedOrders}
          pending={bulk.pending}
          running={bulk.running}
          onApply={bulk.applyStatus}
          onUndo={bulk.undo}
          onApplyNow={bulk.applyNow}
          onClear={selection.clear}
        />
      </div>

      {selectedOrder && (
        <OrderDetailsModal
          selectedOrder={selectedOrder}
          notificationMessage={notificationMessage}
          sendingNotification={sendingNotification}
          shippingZones={shippingZones}
          updatingShipping={updatingShipping}
          resolvingRequestId={resolvingRequestId}
          onClose={closeOrderDetails}
          onNotificationMessageChange={setNotificationMessage}
          onSendNotification={sendCustomNotification}
          onUpdateShipping={updateOrderShipping}
          onResolveChangeRequest={resolveChangeRequest}
        />
      )}
    </>
  );
}

export default function AdminOrders() {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <AdminOrdersContent />
    </Suspense>
  );
}
