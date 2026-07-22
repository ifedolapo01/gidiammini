/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/ChangeRequestReviewCard.tsx
import { useState } from 'react';
import { CalendarClock, Truck } from 'lucide-react';
import { Badge, Button, Textarea } from '@/components/ui';
import type { OrderChangeRequest, DeliveryMethodChangeDetails, RescheduleDetails } from '@/types/orderChangeRequest';
import { formatDate } from '@/lib/commerce/format-date';

interface ChangeRequestReviewCardProps {
  changeRequest: OrderChangeRequest;
  isResolving: boolean;
  onApprove: (adminResponse?: string) => void;
  onReject: (adminResponse?: string) => void;
}

function RequestSummary({ changeRequest }: { changeRequest: OrderChangeRequest }) {
  if (changeRequest.request_type === 'reschedule') {
    const { preferredDate } = changeRequest.details as RescheduleDetails;
    return (
      <p className="text-body-sm text-text-secondary">
        Requested new date: <span className="font-medium text-text-primary">{preferredDate}</span>
      </p>
    );
  }

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

export default function ChangeRequestReviewCard({ changeRequest, isResolving, onApprove, onReject }: ChangeRequestReviewCardProps) {
  const [adminResponse, setAdminResponse] = useState('');
  const Icon = changeRequest.request_type === 'reschedule' ? CalendarClock : Truck;

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-warning" />
        <h3 className="font-semibold text-text-primary">
          {changeRequest.request_type === 'reschedule' ? 'Reschedule Request' : 'Delivery Method Change Request'}
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
          onClick={() => onApprove(adminResponse || undefined)}
          disabled={isResolving}
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
