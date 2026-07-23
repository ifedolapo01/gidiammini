/** STOREFRONT layer — lets a customer request a reschedule or a pickup<->delivery
 * switch from the tracking page. Every request needs the seller's explicit
 * approval before it takes effect (see canRequestOrderChange). */
'use client';

import { useState } from 'react';
import { CalendarClock, Repeat, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { canRequestOrderChange, canCancelOrder } from '@/lib/commerce/order-status';
import { isPickupAvailable } from '@/lib/commerce/checkout';
import { useActiveShippingZones } from '@/components/checkout/hooks/useActiveShippingZones';
import type { Order } from '@/types/order';
import type { RescheduleDetails, DeliveryMethodChangeDetails } from '@/types/orderChangeRequest';
import RescheduleRequestForm from './RescheduleRequestForm';
import DeliveryMethodChangeForm from './DeliveryMethodChangeForm';
import CancelOrderForm from './CancelOrderForm';

interface RequestChangeActionsProps {
  order: Order;
  orderNumber: string;
  contact: string;
  onOrderUpdate: () => void;
}

function PendingRequestBanner({ request }: { request: NonNullable<Order['order_change_requests']>[number] }) {
  const summary = request.request_type === 'reschedule'
    ? `Reschedule to ${(request.details as RescheduleDetails).preferredDate}`
    : request.request_type === 'cancel'
    ? 'Cancel this order'
    : `Switch to ${(request.details as DeliveryMethodChangeDetails).newDeliveryOption}`;

  return (
    <div className="bg-warning-background border border-warning-border p-4 rounded-surface">
      <p className="font-semibold text-warning text-body-sm">Request submitted — awaiting review</p>
      <p className="text-body-sm text-text-secondary mt-1">{summary}</p>
    </div>
  );
}

export default function RequestChangeActions({ order, orderNumber, contact, onOrderUpdate }: RequestChangeActionsProps) {
  const [openForm, setOpenForm] = useState<'reschedule' | 'delivery' | 'cancel' | null>(null);
  const { zones } = useActiveShippingZones();

  const pendingRequest = order.order_change_requests?.find((r) => r.status === 'pending');

  if (pendingRequest) {
    return <PendingRequestBanner request={pendingRequest} />;
  }

  const canChangeSchedule = canRequestOrderChange(order.status);
  const canCancel = canCancelOrder(order.status);

  if (!canChangeSchedule && !canCancel) return null;

  const canSwitchToPickup = order.delivery_option === 'delivery'
    && isPickupAvailable(zones, order.selected_state, order.selected_lga ?? undefined, order.selected_place ?? undefined);
  const canSwitchToDelivery = order.delivery_option === 'pickup';

  const handleSubmitted = () => {
    setOpenForm(null);
    onOrderUpdate();
  };

  return (
    <div className="bg-surface p-4 md:p-6 rounded-surface shadow-elevation-1 border border-border">
      <h3 className="font-bold text-body-md md:text-body-lg text-text-primary mb-3">Need to make a change?</h3>
      <div className="flex flex-col sm:flex-row gap-3">
        {canChangeSchedule && (
          <Button variant="outline" onClick={() => setOpenForm('reschedule')} className="flex-1">
            <CalendarClock className="w-4 h-4" />
            Request Reschedule
          </Button>
        )}
        {canChangeSchedule && (canSwitchToPickup || canSwitchToDelivery) && (
          <Button variant="outline" onClick={() => setOpenForm('delivery')} className="flex-1">
            <Repeat className="w-4 h-4" />
            Switch to {order.delivery_option === 'pickup' ? 'Delivery' : 'Pickup'}
          </Button>
        )}
        {canCancel && (
          <Button
            variant="outline"
            onClick={() => setOpenForm('cancel')}
            className="flex-1 text-destructive border-destructive-border hover:bg-destructive-background"
          >
            <XCircle className="w-4 h-4" />
            Cancel Order
          </Button>
        )}
      </div>

      {openForm === 'reschedule' && (
        <RescheduleRequestForm
          orderNumber={orderNumber}
          contact={contact}
          onClose={() => setOpenForm(null)}
          onSubmitted={handleSubmitted}
        />
      )}
      {openForm === 'delivery' && (
        <DeliveryMethodChangeForm
          orderNumber={orderNumber}
          contact={contact}
          currentOption={order.delivery_option}
          onClose={() => setOpenForm(null)}
          onSubmitted={handleSubmitted}
        />
      )}
      {openForm === 'cancel' && (
        <CancelOrderForm
          orderNumber={orderNumber}
          contact={contact}
          onClose={() => setOpenForm(null)}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}
