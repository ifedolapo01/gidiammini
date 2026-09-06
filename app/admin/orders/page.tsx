/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/page.tsx
//
// The page is a view over one server-selected page of orders: the filter,
// search and sort controls write query parameters, and the counts come from
// the summary endpoint rather than from reducing an array the browser had to
// hold in full.
//
// The transition dialogs are rendered here rather than inside OrderCard — see
// OrderTransitionDialogs for why.
'use client';
import { OrdersSkeleton } from './components/OrdersSkeleton';

import { Suspense } from 'react';
import OrderDetailsModal from './components/OrderDetailsModal';
import OrdersList from './components/OrdersList';
import OrdersPageHeader from './components/OrdersPageHeader';
import OrderFilters from './components/OrderFilters';
import DateRangeNotice from './components/DateRangeNotice';
import EmptyOrders from './components/EmptyOrders';
import OrderStatsSummary from './components/OrderStatsSummary';
import OrdersBulkBar from './components/OrdersBulkBar';
import OrderTransitionDialogs from './components/OrderTransitionDialogs';
import BulkResultSummary from '../components/BulkResultSummary';
import { useTableSelection } from '../hooks/useTableSelection';
import { useOrders } from './hooks/useOrders';
import { useShippingZoneOptions } from './hooks/useShippingZoneOptions';
import { useOrdersView } from './hooks/useOrdersView';
import { useTableDensity } from '../hooks/useTableDensity';

function AdminOrdersContent() {
  const {
    params,
    orders,
    meta,
    loading,
    error,
    summary,
    live,
    requestStatusChange,
    pendingTransition,
    confirmPending,
    dismissPending,
    applyingTransition,
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
    reconcile,
    showToast,
  } = useOrders();

  const { zones: shippingZones } = useShippingZoneOptions();
  const selection = useTableSelection(orders.map((order) => order.id));
  const selectedOrders = orders.filter((order) => selection.isSelected(order.id));
  const { view, setView } = useOrdersView();
  const { density, setDensity } = useTableDensity();

  if (loading && orders.length === 0) return <OrdersSkeleton />;

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8">
        <OrdersPageHeader
          total={meta.total}
          live={live}
          view={view}
          onViewChange={setView}
          density={density}
          onDensityChange={setDensity}
        />

        <DateRangeNotice
          from={params.filters.from}
          to={params.filters.to}
          onClear={() => {
            params.setFilter('from', '');
            params.setFilter('to', '');
          }}
        />

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
          <div className="mb-6 rounded-control border border-destructive-border bg-destructive-background p-4">
            <p className="font-medium text-destructive">Error: {error}</p>
          </div>
        )}

        {orders.length === 0 ? (
          <EmptyOrders filtered={Boolean(params.search || params.filters.from)} />
        ) : (
          <>
            <OrdersList
              orders={orders}
              view={view}
              density={density}
              selection={selection}
              shippingZones={shippingZones}
              loading={loading}
              meta={meta}
              sort={params.sort}
              direction={params.direction}
              onSortChange={params.setSort}
              onPageChange={params.setPage}
              limit={params.limit}
              onLimitChange={params.setLimit}
              onOpenDetails={openOrderDetails}
              onUpdateStatus={requestStatusChange}
            />
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
          showToast={showToast}
          onClose={closeOrderDetails}
          onRefresh={reconcile}
          onNotificationMessageChange={setNotificationMessage}
          onSendNotification={sendCustomNotification}
          onUpdateShipping={updateOrderShipping}
          onResolveChangeRequest={resolveChangeRequest}
        />
      )}

      <OrderTransitionDialogs
        pending={pendingTransition}
        saving={applyingTransition}
        onConfirm={confirmPending}
        onDismiss={dismissPending}
      />
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
