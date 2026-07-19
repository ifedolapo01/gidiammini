/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderStatsSummary.tsx
import { Order } from '@/types/order';

interface OrderStatsSummaryProps {
  orders: Order[];
}

export default function OrderStatsSummary({ orders }: OrderStatsSummaryProps) {
  return (
    <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
        <p className="text-body-sm text-text-secondary">Total Orders</p>
        <p className="text-h4 font-bold text-text-primary">{orders.length}</p>
      </div>
      <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
        <p className="text-body-sm text-text-secondary">Pending</p>
        <p className="text-h4 font-bold text-warning">
          {orders.filter(o => o.status === 'pending').length}
        </p>
      </div>
      <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
        <p className="text-body-sm text-text-secondary">Total Revenue</p>
        <p className="text-h4 font-bold text-success">
          ₦{orders
            .filter(order => order.status !== 'cancelled')
            .reduce((sum, order) => sum + order.total_amount, 0)
            .toLocaleString()
          }
        </p>
        <p className="text-caption-md text-text-secondary mt-1">Excluding cancelled orders</p>
      </div>
      <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
        <p className="text-body-sm text-text-secondary">Paid Orders</p>
        <p className="text-h4 font-bold text-info">
          {orders.filter(o => o.payment_verified).length}
        </p>
      </div>
    </div>
  );
}
