/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderCard.tsx
import { useState } from 'react';
import { Eye, Send, Truck } from 'lucide-react';
import { Badge, Button, Select } from '@/components/ui';
import { Order, OrderItem } from '@/types/order';
import type { ShippingZone } from '@/types/shipping';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';
import { getStatusIcon, getStatusColor, getStatusOptions, formatOrderStatus } from '@/lib/commerce/order-status';
import { getShippingOverdueInfo } from '@/lib/commerce/shipping-overdue';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';

const calculateSubtotal = (items: OrderItem[] = []) => {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
};

/** e.g. 30 -> "1d 6h overdue"; 5 -> "5h overdue". */
function formatOverdue(hoursOverdue: number): string {
  const days = Math.floor(hoursOverdue / 24);
  const hours = hoursOverdue % 24;
  return days > 0 ? `${days}d ${hours}h overdue` : `${hours}h overdue`;
}

interface OrderCardProps {
  order: Order;
  shippingZones?: ShippingZone[];
  onOpenDetails: (order: Order) => void;
  onUpdateStatus: (orderId: string, newStatus: Order['status']) => void;
}

export default function OrderCard({ order, shippingZones = [], onOpenDetails, onUpdateStatus }: OrderCardProps) {
  const [showReceipt, setShowReceipt] = useState(false);
  const hasPendingChangeRequest = order.order_change_requests?.some((r) => r.status === 'pending');
  const overdueInfo = getShippingOverdueInfo(order, shippingZones);
  const nextStatuses = getStatusOptions(order.status, order.delivery_option);

  return (
    <div className="bg-surface rounded-surface shadow-elevation-1 border border-border overflow-hidden hover:shadow-elevation-2 transition-shadow">
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-4 md:mb-6">
          <div className="flex-1 mb-4 md:mb-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {getStatusIcon(order.status)}
              <span className="font-bold text-body-lg text-text-primary">{order.order_number}</span>
              <span className={`px-3 py-1 rounded-full text-caption-md font-medium ${getStatusColor(order.status)}`}>
                {formatOrderStatus(order.status)}
              </span>
              <Badge tone={order.payment_verified ? 'success' : 'destructive'}>
                {order.payment_verified ? 'Paid' : 'Unpaid'}
              </Badge>
              {hasPendingChangeRequest && (
                <Badge tone="warning">Pending Request</Badge>
              )}
              {overdueInfo && (
                <Badge tone="destructive">
                  <Truck className="w-3 h-3" />
                  {formatOverdue(overdueInfo.hoursOverdue)}
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <p className="font-medium text-text-primary">
                {order.customer_name}
              </p>
              <p className="text-text-secondary text-body-sm">
                {order.customer_email}
              </p>
              <p className="text-text-secondary text-body-sm">
                📞 {order.customer_phone}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={order.delivery_option === 'pickup' ? 'info' : 'neutral'}>
                {order.delivery_option === 'pickup' ? 'Pickup' : 'Delivery'} • {order.selected_state}
              </Badge>
              {order.receipt_path && (
                <button
                  type="button"
                  onClick={() => setShowReceipt(true)}
                  className="px-3 py-1 bg-success-background text-success rounded-full text-caption-md hover:bg-success-border transition-colors"
                >
                  View Receipt
                </button>
              )}
              {order.note && (
                <Badge tone="warning">
                  Has Note
                </Badge>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="font-bold text-h4 text-text-primary">
              {formatCurrency(order.total_amount)}
            </p>
            <p className="text-body-sm text-text-secondary mt-1">
              {formatDate(order.created_at)}
            </p>
            {order.delivery_option === 'delivery' && order.delivery_address && (
              <p className="text-body-sm text-text-secondary mt-2 max-w-xs">
                📍 {order.delivery_address}, {order.city}
              </p>
            )}
          </div>
        </div>

        {/* Order Items Preview */}
        {order.order_items && order.order_items.length > 0 && (
          <div className="mb-4 p-3 bg-background-secondary rounded-surface">
            <p className="font-medium text-text-primary text-body-sm mb-2">Order Items:</p>
            <div className="space-y-1">
              {order.order_items.slice(0, 2).map((item, index) => (
                <div key={index} className="flex justify-between text-body-sm">
                  <span className="text-text-secondary">
                    {item.product_name} × {item.quantity}
                    {item.size && ` (${item.size})`}
                    {item.color && ` • ${item.color}`}
                  </span>
                  <span className="font-medium text-primary">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
              {order.order_items.length > 2 && (
                <p className="text-text-secondary text-caption-md mt-1">
                  +{order.order_items.length - 2} more items
                  ({formatCurrency(calculateSubtotal(order.order_items.slice(2)))})
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <p className="text-body-sm text-text-secondary">
              Order ID: <span className="font-mono text-text-primary">{order.id.slice(0, 8)}...</span>
            </p>
            <button
              onClick={() => onOpenDetails(order)}
              className="text-primary hover:text-primary-hover text-body-sm font-medium flex items-center gap-1"
            >
              <Eye className="w-4 h-4" />
              Details
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select
              value={order.status}
              onChange={(e) => onUpdateStatus(order.id, e.target.value as Order['status'])}
              disabled={nextStatuses.length === 0}
              className="w-auto"
            >
              <option value={order.status} disabled>
                {nextStatuses.length > 0 ? 'Change status…' : formatOrderStatus(order.status)}
              </option>
              {nextStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatOrderStatus(status)}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              onClick={() => onOpenDetails(order)}
            >
              <Send className="w-4 h-4" />
              Notify
            </Button>
          </div>
        </div>
      </div>

      {showReceipt && order.receipt_path && (
        <ReceiptPreviewModal orderId={order.id} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  );
}
