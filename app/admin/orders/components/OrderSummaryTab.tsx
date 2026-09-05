/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderSummaryTab.tsx
//
// The order at a glance: who, what, where it is going, what it costs and what
// is still owed.
//
// This was the whole of OrderDetailsModal until the modal grew tabs for
// editing and refunds. It is read-only on purpose — every mutation on this tab
// is a small, named form of its own (shipping override, tracking, notify) —
// so nothing here can change a line or a price by accident while somebody is
// reading it.
import { Badge } from '@/components/ui';
import type { Order } from '@/types/order';
import type { ShippingZone } from '@/types/shipping';
import { formatCurrency } from '@/lib/commerce/pricing';
import { getStatusColor, formatOrderStatus } from '@/lib/commerce/order-status';
import OrderMoneySummary from './OrderMoneySummary';
import OrderTrackingCard from './OrderTrackingCard';
import ShippingOverrideForm from './ShippingOverrideForm';
import ChangeRequestReviewCard from './ChangeRequestReviewCard';
import OrderNotifyForm from './OrderNotifyForm';

interface OrderSummaryTabProps {
  order: Order;
  shippingZones: ShippingZone[];
  updatingShipping: boolean;
  resolvingRequestId: string | null;
  notificationMessage: string;
  sendingNotification: string | null;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onRefresh: () => Promise<void> | void;
  onNotificationMessageChange: (message: string) => void;
  onSendNotification: (orderId: string) => void;
  onUpdateShipping: (orderId: string, shippingZoneId: string, deliveryOption: 'pickup' | 'delivery') => void;
  onResolveChangeRequest: (requestId: string, decision: 'approved' | 'rejected', adminResponse?: string) => void;
}

export default function OrderSummaryTab({
  order,
  shippingZones,
  updatingShipping,
  resolvingRequestId,
  notificationMessage,
  sendingNotification,
  showToast,
  onRefresh,
  onNotificationMessageChange,
  onSendNotification,
  onUpdateShipping,
  onResolveChangeRequest,
}: OrderSummaryTabProps) {
  const pendingChangeRequest = order.order_change_requests?.find((request) => request.status === 'pending');

  return (
    <>
      <div className="mb-6">
        <h3 className="mb-3 font-semibold text-text-primary">Customer</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-body-sm text-text-secondary">Name</p>
            <p className="font-medium text-text-primary">{order.customer_name}</p>
          </div>
          <div>
            <p className="text-body-sm text-text-secondary">Email</p>
            <p className="font-medium text-text-primary">{order.customer_email}</p>
          </div>
          <div>
            <p className="text-body-sm text-text-secondary">Phone</p>
            <p className="font-medium text-text-primary">{order.customer_phone}</p>
          </div>
          <div>
            <p className="text-body-sm text-text-secondary">Status</p>
            <span
              className={`rounded-control px-2 py-1 text-caption-md font-medium ${getStatusColor(order.status)}`}
            >
              {formatOrderStatus(order.status)}
            </span>
          </div>
        </div>
      </div>

      <OrderMoneySummary order={order} />

      {order.order_items && order.order_items.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 font-semibold text-text-primary">Items</h3>
          <div className="space-y-2">
            {order.order_items.map((item, index) => (
              <div
                key={item.id ?? index}
                className="flex items-center justify-between gap-3 rounded-surface bg-background-secondary p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">{item.product_name}</p>
                  <p className="text-body-sm text-text-secondary">
                    Quantity: {item.quantity}
                    {item.size && ` • Size/Age: ${item.size}`}
                    {item.color && ` • Color: ${item.color}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium text-text-primary">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                  <p className="text-caption-md text-text-secondary">
                    {formatCurrency(item.price)} each
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="mb-3 font-semibold text-text-primary">Delivery</h3>
        <div className="rounded-surface bg-info-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={order.delivery_option === 'pickup' ? 'info' : 'neutral'}>
              {order.delivery_option === 'pickup' ? 'Pickup' : 'Delivery'}
            </Badge>
            <span className="text-body-sm text-text-secondary">{order.selected_state}</span>
          </div>
          {order.delivery_address && (
            <p className="mt-1 text-body-sm text-text-secondary">
              {order.delivery_address}
              {order.city ? `, ${order.city}` : ''}
            </p>
          )}
          {order.note && (
            <div className="mt-2 rounded-control bg-warning-background p-2">
              <p className="text-body-sm font-medium text-text-primary">Customer note</p>
              <p className="text-body-sm text-text-secondary">{order.note}</p>
            </div>
          )}
        </div>
      </div>

      <OrderTrackingCard order={order} showToast={showToast} onSaved={onRefresh} />

      <ShippingOverrideForm
        order={order}
        zones={shippingZones}
        isUpdating={updatingShipping}
        onUpdate={onUpdateShipping}
      />

      {pendingChangeRequest && (
        <ChangeRequestReviewCard
          changeRequest={pendingChangeRequest}
          isResolving={resolvingRequestId === pendingChangeRequest.id}
          onApprove={(adminResponse) =>
            onResolveChangeRequest(pendingChangeRequest.id, 'approved', adminResponse)
          }
          onReject={(adminResponse) =>
            onResolveChangeRequest(pendingChangeRequest.id, 'rejected', adminResponse)
          }
        />
      )}

      <OrderNotifyForm
        order={order}
        message={notificationMessage}
        sending={sendingNotification === order.id}
        onMessageChange={onNotificationMessageChange}
        onSend={onSendNotification}
      />
    </>
  );
}
