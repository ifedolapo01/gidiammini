/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/ChangeRequestReviewCard.tsx
import { useState } from 'react';
import { CalendarClock, Truck, XCircle, MapPin, Repeat, PackagePlus, Undo2, PauseCircle } from 'lucide-react';
import { Badge, Button, Input, Textarea } from '@/components/ui';
import type {
  OrderChangeRequest,
  DeliveryMethodChangeDetails,
  RescheduleDetails,
  AddressCorrectionDetails,
  ItemSwapDetails,
  AddItemDetails,
  ReturnRequestDetails,
  HoldUntilDetails,
} from '@/types/orderChangeRequest';
import type { OrderItem } from '@/types/order';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';

interface ChangeRequestReviewCardProps {
  changeRequest: OrderChangeRequest;
  /** Named order items, for a return request's default refund amount. */
  orderItems: OrderItem[];
  isResolving: boolean;
  onApprove: (adminResponse?: string, refundAmount?: number) => void;
  onReject: (adminResponse?: string) => void;
}

const REQUEST_TYPE_LABELS: Record<OrderChangeRequest['request_type'], string> = {
  reschedule: 'Reschedule Request',
  delivery_method_change: 'Delivery Method Change Request',
  cancel: 'Cancellation Request',
  address_correction: 'Address Correction Request',
  item_swap: 'Item Swap Request',
  add_item: 'Add Item Request',
  return_request: 'Return Request',
  hold_until: 'Hold Order Request',
};

const REQUEST_TYPE_ICONS: Record<OrderChangeRequest['request_type'], typeof CalendarClock> = {
  reschedule: CalendarClock,
  delivery_method_change: Truck,
  cancel: XCircle,
  address_correction: MapPin,
  item_swap: Repeat,
  add_item: PackagePlus,
  return_request: Undo2,
  hold_until: PauseCircle,
};

function RequestSummary({ changeRequest }: { changeRequest: OrderChangeRequest }) {
  switch (changeRequest.request_type) {
    case 'reschedule': {
      const { preferredDate } = changeRequest.details as RescheduleDetails;
      return (
        <p className="text-body-sm text-text-secondary">
          Requested new date: <span className="font-medium text-text-primary">{preferredDate}</span>
        </p>
      );
    }
    case 'cancel':
      return <p className="text-body-sm text-text-secondary">Customer requested to cancel this order.</p>;
    case 'delivery_method_change': {
      const { newDeliveryOption, deliveryAddress, city } = changeRequest.details as DeliveryMethodChangeDetails;
      return (
        <p className="text-body-sm text-text-secondary">
          Switch to <span className="font-medium text-text-primary">{newDeliveryOption}</span>
          {newDeliveryOption === 'delivery' && deliveryAddress && (
            <> — {deliveryAddress}, {city}</>
          )}
        </p>
      );
    }
    case 'address_correction': {
      const { newAddress, city } = changeRequest.details as AddressCorrectionDetails;
      return (
        <p className="text-body-sm text-text-secondary">
          Correct the address to <span className="font-medium text-text-primary">{newAddress}</span>
          {city && <>, {city}</>}
        </p>
      );
    }
    case 'item_swap': {
      const { newSize, newColor } = changeRequest.details as ItemSwapDetails;
      return (
        <p className="text-body-sm text-text-secondary">
          Swap for{' '}
          <span className="font-medium text-text-primary">
            {[newSize, newColor].filter(Boolean).join(', ') || 'a different size/colour'}
          </span>
          . Resolved against live stock on approval.
        </p>
      );
    }
    case 'add_item': {
      const { size, color, quantity } = changeRequest.details as AddItemDetails;
      return (
        <p className="text-body-sm text-text-secondary">
          Add <span className="font-medium text-text-primary">{quantity}</span> more
          {[size, color].some(Boolean) && <> in {[size, color].filter(Boolean).join(', ')}</>} of an item
          already on this order.
        </p>
      );
    }
    case 'return_request': {
      const { orderItemIds, reason } = changeRequest.details as ReturnRequestDetails;
      return (
        <p className="text-body-sm text-text-secondary">
          Return {orderItemIds.length} item{orderItemIds.length === 1 ? '' : 's'} — {reason}
        </p>
      );
    }
    case 'hold_until': {
      const { holdUntilDate } = changeRequest.details as HoldUntilDetails;
      return (
        <p className="text-body-sm text-text-secondary">
          Hold shipping until <span className="font-medium text-text-primary">{holdUntilDate}</span>
        </p>
      );
    }
  }
}

/** Sum of the named lines' price × quantity — the starting point for the
 *  refund amount, never the final word: a partial return, a restocking
 *  deduction, all still need a human to confirm the figure. */
function defaultReturnAmount(details: ReturnRequestDetails, orderItems: OrderItem[]): number {
  const named = new Set(details.orderItemIds);
  return orderItems
    .filter((item) => item.id && named.has(item.id))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export default function ChangeRequestReviewCard({
  changeRequest,
  orderItems,
  isResolving,
  onApprove,
  onReject,
}: ChangeRequestReviewCardProps) {
  const [adminResponse, setAdminResponse] = useState('');
  const isReturn = changeRequest.request_type === 'return_request';
  const [refundAmount, setRefundAmount] = useState(() =>
    isReturn ? defaultReturnAmount(changeRequest.details as ReturnRequestDetails, orderItems) : 0
  );

  const Icon = REQUEST_TYPE_ICONS[changeRequest.request_type];

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-warning" />
        <h3 className="font-semibold text-text-primary">
          {REQUEST_TYPE_LABELS[changeRequest.request_type]}
        </h3>
        <Badge tone="warning">Pending Review</Badge>
      </div>

      <div className="p-3 bg-warning-background rounded-surface space-y-1">
        <RequestSummary changeRequest={changeRequest} />
        {changeRequest.customer_note && (
          <p className="text-body-sm text-text-secondary">Note: {changeRequest.customer_note}</p>
        )}
        <p className="text-caption-md text-text-secondary">Requested {formatDate(changeRequest.created_at)}</p>
      </div>

      {isReturn && (
        <div className="mt-3">
          <label className="block text-body-sm font-medium text-text-primary mb-1.5">
            Refund amount (₦) — confirm before approving
          </label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={refundAmount}
            onChange={(e) => setRefundAmount(Math.max(0, Number(e.target.value) || 0))}
          />
          <p className="mt-1 text-caption-md text-text-secondary">
            Defaulted to the named lines&rsquo; value ({formatCurrency(refundAmount)}) — adjust for a restocking
            deduction or a partial return.
          </p>
        </div>
      )}

      <div className="mt-3">
        <label className="block text-body-sm font-medium text-text-primary mb-1.5">
          Response to customer (optional)
        </label>
        <Textarea
          value={adminResponse}
          onChange={(e) => setAdminResponse(e.target.value)}
          placeholder="e.g. a reason, if rejecting"
          rows={2}
        />
      </div>

      <div className="flex gap-3 mt-3">
        <Button
          onClick={() => onApprove(adminResponse || undefined, isReturn ? refundAmount : undefined)}
          disabled={isResolving || (isReturn && refundAmount <= 0)}
          loading={isResolving}
          className="flex-1 font-semibold"
        >
          Approve
        </Button>
        <Button
          variant="outline"
          onClick={() => onReject(adminResponse || undefined)}
          disabled={isResolving}
          className="flex-1 font-semibold"
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
