/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/page.tsx - UPDATED
'use client';

import { Package, RefreshCw } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import Toast from '@/components/Toast';
import OrderDetailsModal from './components/OrderDetailsModal';
import OrderCard from './components/OrderCard';
import OrderFilters from './components/OrderFilters';
import OrderStatsSummary from './components/OrderStatsSummary';
import { useOrders } from './hooks/useOrders';
import { useOrderFilters } from './hooks/useOrderFilters';
import { useShippingZoneOptions } from './hooks/useShippingZoneOptions';

export default function AdminOrders() {
  const {
    orders,
    loading,
    refreshing,
    refreshOrders,
    updateOrderStatus,
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
    toast,
    clearToast,
  } = useOrders();

  const { filter, setFilter, searchTerm, setSearchTerm, searchedOrders } = useOrderFilters(orders);
  const { zones: shippingZones } = useShippingZoneOptions();

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Spinner size="xl" className="text-primary mx-auto mb-4" />
            <div className="text-body-lg text-text-secondary">Loading orders...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-h4 md:text-h3 font-bold text-text-primary">Manage Orders</h1>
            <p className="text-text-secondary mt-1">
              {searchedOrders.length} order{searchedOrders.length !== 1 ? 's' : ''} found
            </p>
          </div>

          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <Button
              variant="outline"
              onClick={refreshOrders}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <OrderFilters
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          filter={filter}
          onFilterChange={setFilter}
        />

        {/* Orders List */}
        {searchedOrders.length === 0 ? (
          <div className="bg-surface rounded-surface shadow-elevation-1 border border-border p-8 md:p-12 text-center">
            <Package className="w-16 h-16 text-text-muted mx-auto mb-4" />
            <h3 className="text-h5 font-semibold text-text-primary mb-2">
              {searchTerm ? 'No orders found' : 'No orders yet'}
            </h3>
            <p className="text-text-secondary">
              {searchTerm
                ? 'Try a different search term'
                : 'Orders will appear here when customers place them'
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            {searchedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onOpenDetails={openOrderDetails}
                onUpdateStatus={updateOrderStatus}
              />
            ))}
          </div>
        )}

        <OrderStatsSummary orders={orders} />
      </div>

      {/* Order Details & Notification Modal */}
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

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={clearToast} />
      )}
    </>
  );
}
