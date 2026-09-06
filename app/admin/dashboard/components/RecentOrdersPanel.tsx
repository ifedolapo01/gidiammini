/** ADMIN layer — "Recent Orders" card on the dashboard. */
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { formatDate } from '@/lib/commerce/format-date';
import { formatCurrency } from '@/lib/commerce/pricing';

interface RecentOrdersPanelProps {
  orders: any[];
}

export function RecentOrdersPanel({ orders }: RecentOrdersPanelProps) {
  return (
    <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-h5 font-bold text-text-primary">Recent Orders</h2>
        <Link
          href="/admin/orders"
          className="text-primary hover:text-primary-hover text-body-sm font-medium"
        >
          View all
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-8">
          <ShoppingBag className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between p-3 hover:bg-surface-hover rounded-control"
            >
              <div>
                <p className="font-medium text-text-primary">{order.order_number}</p>
                <p className="text-body-sm text-text-secondary">{order.customer_name}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-text-primary">{formatCurrency(order.total_amount)}</p>
                <p className="text-caption-md text-text-secondary">{formatDate(order.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
