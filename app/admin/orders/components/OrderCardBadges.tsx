/** ADMIN layer — the identifying row at the top of an order card: its
 * selection checkbox, order number, and the badges that say at a glance what
 * needs attention.
 *
 * Split out of OrderCard.tsx to keep that file under the project's line-count
 * cap once the checkbox column arrived.
 */
import { Truck } from 'lucide-react';
import { Badge } from '@/components/ui';
import { Order } from '@/types/order';
import { getStatusIcon, getStatusColor, formatOrderStatus } from '@/lib/commerce/order-status';
import type { ShippingOverdueInfo } from '@/lib/commerce/shipping-overdue';
import { RowCheckbox } from '@/app/admin/components/SelectionCheckbox';

/** e.g. 30 -> "1d 6h overdue"; 5 -> "5h overdue". */
function formatOverdue(hoursOverdue: number): string {
  const days = Math.floor(hoursOverdue / 24);
  const hours = hoursOverdue % 24;
  return days > 0 ? `${days}d ${hours}h overdue` : `${hours}h overdue`;
}

interface OrderCardBadgesProps {
  order: Order;
  selected: boolean;
  onToggleSelect: (orderId: string) => void;
  overdueInfo: ShippingOverdueInfo | null;
}

export default function OrderCardBadges({
  order,
  selected,
  onToggleSelect,
  overdueInfo,
}: OrderCardBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <RowCheckbox
        checked={selected}
        onChange={() => onToggleSelect(order.id)}
        rowLabel={`order ${order.order_number}`}
      />
      {getStatusIcon(order.status)}
      <span className="font-bold text-body-lg text-text-primary">{order.order_number}</span>
      <span className={`px-3 py-1 rounded-full text-caption-md font-medium ${getStatusColor(order.status)}`}>
        {formatOrderStatus(order.status)}
      </span>
      <Badge tone={order.payment_verified ? 'success' : 'destructive'}>
        {order.payment_verified ? 'Paid' : 'Unpaid'}
      </Badge>
      {/* A boolean from the list projection. The full change-request rows are
          only fetched for the order somebody actually opens. */}
      {order.has_pending_change_request && <Badge tone="warning">Pending Request</Badge>}
      {overdueInfo && (
        <Badge tone="destructive">
          <Truck className="w-3 h-3" />
          {formatOverdue(overdueInfo.hoursOverdue)}
        </Badge>
      )}
    </div>
  );
}
