/**
 * ADMIN layer — the actions menu at the end of an order row in the table view.
 *
 * Details, then the statuses this order may actually move to. getStatusOptions
 * is the same function the card's dropdown uses, so the two views can never
 * offer different transitions — it is forward-only and knows the difference
 * between a pickup and a delivery. A delivered or cancelled order returns
 * none, and the menu is just "View details".
 */
'use client';

import { Eye } from 'lucide-react';
import { formatOrderStatus, getStatusOptions } from '@/lib/commerce/order-status';
import type { Order } from '@/types/order';
import RowActionsMenu from '../../components/RowActionsMenu';

interface OrderRowActionsProps {
  order: Order;
  onOpenDetails: (order: Order) => void;
  onUpdateStatus: (order: Order, status: Order['status']) => void;
}

export default function OrderRowActions({
  order,
  onOpenDetails,
  onUpdateStatus,
}: OrderRowActionsProps) {
  const nextStatuses = getStatusOptions(order.status, order.delivery_option);

  return (
    <RowActionsMenu
      rowLabel={`order ${order.order_number}`}
      actions={[
        {
          label: 'View details',
          icon: <Eye size={15} aria-hidden />,
          onClick: () => onOpenDetails(order),
        },
        ...nextStatuses.map((status) => ({
          label: `Mark ${formatOrderStatus(status).toLowerCase()}`,
          onClick: () => onUpdateStatus(order, status),
        })),
      ]}
    />
  );
}
