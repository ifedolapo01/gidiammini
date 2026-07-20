/** STOREFRONT layer — status timeline + delivery/pickup details + items for a tracked order. */
'use client';

import { MapPin, Store } from 'lucide-react';
import { formatCurrency } from '@/lib/commerce/pricing';
import { getStatusColor, formatOrderStatus } from '@/lib/commerce/order-status';
import type { Order } from '@/types/order';
import OrderStatusTimeline from './OrderStatusTimeline';

interface TrackedOrderSummaryProps {
  order: Order;
}

export default function TrackedOrderSummary({ order }: TrackedOrderSummaryProps) {
  const isPickup = order.delivery_option === 'pickup';

  return (
    <div className="space-y-6">
      <div className="bg-surface p-4 md:p-6 rounded-surface shadow-elevation-1 border border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 md:mb-6">
          <div>
            <p className="text-body-sm text-text-secondary">Order Number</p>
            <p className="font-bold text-body-lg md:text-h5 text-text-primary">#{order.order_number}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-caption-md md:text-body-sm font-medium uppercase ${getStatusColor(order.status)}`}>
            {formatOrderStatus(order.status)}
          </span>
        </div>

        <OrderStatusTimeline status={order.status} deliveryOption={order.delivery_option} />
      </div>

      <div className="bg-surface p-4 md:p-6 rounded-surface shadow-elevation-1 border border-border">
        <h3 className="font-bold text-body-md md:text-body-lg text-text-primary mb-3 md:mb-4">
          {isPickup ? 'Pickup Details' : 'Delivery Details'}
        </h3>
        <div className="flex items-start gap-2 text-body-sm md:text-body-md text-text-primary">
          {isPickup ? (
            <Store className="w-5 h-5 text-info mt-0.5 shrink-0" />
          ) : (
            <MapPin className="w-5 h-5 text-info mt-0.5 shrink-0" />
          )}
          <p>
            {isPickup
              ? `Pickup in ${order.selected_state}`
              : [order.delivery_address, order.city, order.selected_lga, order.selected_state].filter(Boolean).join(', ')
            }
          </p>
        </div>
        {order.note && (
          <div className="mt-3 p-3 bg-warning-background rounded-control">
            <p className="text-body-sm font-medium text-text-primary">Your Note:</p>
            <p className="text-body-sm text-text-secondary">{order.note}</p>
          </div>
        )}
      </div>

      <div className="bg-surface p-4 md:p-6 rounded-surface shadow-elevation-1 border border-border">
        <h3 className="font-bold text-body-md md:text-body-lg text-text-primary mb-3 md:mb-4">Order Items</h3>
        <div className="space-y-3">
          {order.order_items?.map((item, index) => (
            <div key={item.id || index} className="flex items-center justify-between pb-3 border-b border-border-light last:border-0 last:pb-0">
              <div>
                <p className="font-medium text-text-primary text-body-sm md:text-body-md">{item.product_name}</p>
                <p className="text-caption-md md:text-body-sm text-text-secondary">
                  Qty: {item.quantity}
                  {item.size && ` • Size: ${item.size}`}
                  {item.color && ` • Color: ${item.color}`}
                </p>
              </div>
              <p className="font-semibold text-text-primary text-body-sm md:text-body-md">
                {formatCurrency(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
          <span className="font-bold text-body-md md:text-body-lg text-text-primary">Total</span>
          <span className="font-bold text-h5 md:text-h4 text-primary">{formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      <div className="bg-background-secondary p-4 rounded-surface text-center">
        <p className="text-body-sm text-text-secondary">Need help with this order?</p>
        <p className="font-bold text-primary">📞 0809 653 9067</p>
      </div>
    </div>
  );
}
