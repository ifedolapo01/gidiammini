/** STOREFRONT layer — lets a customer request a change on their own order.
 * Every request needs the seller's explicit approval before it takes effect
 * (see canRequestOrderChange/canRequestReturn in lib/commerce/order-status.ts). */
'use client';

import { useState } from 'react';
import {
  CalendarClock, Repeat, XCircle, MapPin, PackagePlus, Undo2, PauseCircle,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { canRequestOrderChange, canCancelOrder, canRequestReturn } from '@/lib/commerce/order-status';
import { isPickupAvailable } from '@/lib/commerce/checkout';
import { useActiveShippingZones } from '@/components/checkout/hooks/useActiveShippingZones';
import type { Order } from '@/types/order';
import type {
  RescheduleDetails,
  DeliveryMethodChangeDetails,
  AddressCorrectionDetails,
  ItemSwapDetails,
  AddItemDetails,
  ReturnRequestDetails,
  HoldUntilDetails,
} from '@/types/orderChangeRequest';
import RescheduleRequestForm from './RescheduleRequestForm';
import DeliveryMethodChangeForm from './DeliveryMethodChangeForm';
import CancelOrderForm from './CancelOrderForm';
import AddressCorrectionForm from './AddressCorrectionForm';
import ItemSwapForm from './ItemSwapForm';
import AddItemForm from './AddItemForm';
import ReturnRequestForm from './ReturnRequestForm';
import HoldUntilForm from './HoldUntilForm';

interface RequestChangeActionsProps {
  order: Order;
  orderNumber: string;
  contact: string;
  onOrderUpdate: () => void;
}

type OpenForm = 'reschedule' | 'delivery' | 'cancel' | 'address' | 'swap' | 'additem' | 'return' | 'hold' | null;

function PendingRequestBanner({ request }: { request: NonNullable<Order['order_change_requests']>[number] }) {
  const d = request.details as any;
  const summary = ({
    reschedule: () => `Reschedule to ${(d as RescheduleDetails).preferredDate}`,
    delivery_method_change: () => `Switch to ${(d as DeliveryMethodChangeDetails).newDeliveryOption}`,
    cancel: () => 'Cancel this order',
    address_correction: () => `Correct address to ${(d as AddressCorrectionDetails).newAddress}`,
    item_swap: () => `Swap for ${[(d as ItemSwapDetails).newSize, (d as ItemSwapDetails).newColor].filter(Boolean).join(', ') || 'a different size/colour'}`,
    add_item: () => `Add ${(d as AddItemDetails).quantity} more of an item on the order`,
    return_request: () => `Return ${(d as ReturnRequestDetails).orderItemIds.length} item(s)`,
    hold_until: () => `Hold until ${(d as HoldUntilDetails).holdUntilDate}`,
  })[request.request_type]();

  return (
    <div className="bg-warning-background border border-warning-border p-4 rounded-surface">
      <p className="font-semibold text-warning text-body-sm">Request submitted: awaiting review</p>
      <p className="text-body-sm text-text-secondary mt-1">{summary}</p>
    </div>
  );
}

export default function RequestChangeActions({ order, orderNumber, contact, onOrderUpdate }: RequestChangeActionsProps) {
  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const { zones } = useActiveShippingZones();

  const pendingRequest = order.order_change_requests?.find((r) => r.status === 'pending');

  if (pendingRequest) {
    return <PendingRequestBanner request={pendingRequest} />;
  }

  const canChangeSchedule = canRequestOrderChange(order.status);
  const canCancel = canCancelOrder(order.status);
  const canReturn = canRequestReturn(order.status, order.delivered_at ?? null);
  const hasNamedProducts = (order.order_items ?? []).some((item) => item.product_id);

  if (!canChangeSchedule && !canCancel && !canReturn) return null;

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
      <div className="flex flex-wrap gap-3">
        {canChangeSchedule && (
          <Button variant="outline" onClick={() => setOpenForm('reschedule')} className="flex-1 min-w-40">
            <CalendarClock className="w-4 h-4" />
            Request Reschedule
          </Button>
        )}
        {canChangeSchedule && (canSwitchToPickup || canSwitchToDelivery) && (
          <Button variant="outline" onClick={() => setOpenForm('delivery')} className="flex-1 min-w-40">
            <Repeat className="w-4 h-4" />
            Switch to {order.delivery_option === 'pickup' ? 'Delivery' : 'Pickup'}
          </Button>
        )}
        {canChangeSchedule && order.delivery_option === 'delivery' && (
          <Button variant="outline" onClick={() => setOpenForm('address')} className="flex-1 min-w-40">
            <MapPin className="w-4 h-4" />
            Correct Address
          </Button>
        )}
        {canChangeSchedule && hasNamedProducts && (
          <Button variant="outline" onClick={() => setOpenForm('swap')} className="flex-1 min-w-40">
            <Repeat className="w-4 h-4" />
            Swap an Item
          </Button>
        )}
        {canChangeSchedule && hasNamedProducts && (
          <Button variant="outline" onClick={() => setOpenForm('additem')} className="flex-1 min-w-40">
            <PackagePlus className="w-4 h-4" />
            Add an Item
          </Button>
        )}
        {canChangeSchedule && (
          <Button variant="outline" onClick={() => setOpenForm('hold')} className="flex-1 min-w-40">
            <PauseCircle className="w-4 h-4" />
            Hold My Order
          </Button>
        )}
        {canReturn && (
          <Button variant="outline" onClick={() => setOpenForm('return')} className="flex-1 min-w-40">
            <Undo2 className="w-4 h-4" />
            Request a Return
          </Button>
        )}
        {canCancel && (
          <Button
            variant="outline"
            onClick={() => setOpenForm('cancel')}
            className="flex-1 min-w-40 text-destructive border-destructive-border hover:bg-destructive-background"
          >
            <XCircle className="w-4 h-4" />
            Cancel Order
          </Button>
        )}
      </div>

      {openForm === 'reschedule' && (
        <RescheduleRequestForm orderNumber={orderNumber} contact={contact} onClose={() => setOpenForm(null)} onSubmitted={handleSubmitted} />
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
        <CancelOrderForm orderNumber={orderNumber} contact={contact} onClose={() => setOpenForm(null)} onSubmitted={handleSubmitted} />
      )}
      {openForm === 'address' && (
        <AddressCorrectionForm orderNumber={orderNumber} contact={contact} onClose={() => setOpenForm(null)} onSubmitted={handleSubmitted} />
      )}
      {openForm === 'swap' && (
        <ItemSwapForm
          orderNumber={orderNumber}
          contact={contact}
          orderItems={order.order_items ?? []}
          onClose={() => setOpenForm(null)}
          onSubmitted={handleSubmitted}
        />
      )}
      {openForm === 'additem' && (
        <AddItemForm
          orderNumber={orderNumber}
          contact={contact}
          orderItems={order.order_items ?? []}
          onClose={() => setOpenForm(null)}
          onSubmitted={handleSubmitted}
        />
      )}
      {openForm === 'return' && (
        <ReturnRequestForm
          orderNumber={orderNumber}
          contact={contact}
          orderItems={order.order_items ?? []}
          onClose={() => setOpenForm(null)}
          onSubmitted={handleSubmitted}
        />
      )}
      {openForm === 'hold' && (
        <HoldUntilForm orderNumber={orderNumber} contact={contact} onClose={() => setOpenForm(null)} onSubmitted={handleSubmitted} />
      )}
    </div>
  );
}
