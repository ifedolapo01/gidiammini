/** STOREFRONT layer — friendly progress stepper for an order's status. Step
 * sequence adapts to delivery vs pickup so customers never see an irrelevant
 * step (e.g. "Ready for Pickup" on a delivery order). */
'use client';

import { CheckCircle, XCircle, CalendarClock } from 'lucide-react';
import { formatCustomerStatusLabel } from '@/lib/commerce/order-status';
import type { Order } from '@/types/order';

const DELIVERY_STEPS: Order['status'][] = ['pending', 'confirmed', 'shipped', 'delivered'];
const PICKUP_STEPS: Order['status'][] = ['pending', 'confirmed', 'ready_for_pickup', 'picked_up'];

interface OrderStatusTimelineProps {
  status: Order['status'];
  deliveryOption: 'pickup' | 'delivery';
}

export default function OrderStatusTimeline({ status, deliveryOption }: OrderStatusTimelineProps) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 p-4 bg-destructive-background border border-destructive-border rounded-surface">
        <XCircle className="w-5 h-5 text-destructive shrink-0" />
        <p className="font-semibold text-destructive text-body-sm md:text-body-md">This order has been cancelled.</p>
      </div>
    );
  }

  const steps = deliveryOption === 'pickup' ? PICKUP_STEPS : DELIVERY_STEPS;
  // 'rescheduled' is a flag on top of the normal flow, not a forward step in
  // either sequence — treat it as "as far along as confirmed" for the
  // progress bar, and call it out separately below.
  const currentIndex = steps.indexOf(status === 'rescheduled' ? 'confirmed' : status);

  return (
    <div>
      <div className="flex items-start">
        {steps.map((step, index) => {
          const isComplete = index <= currentIndex;
          return (
            <div key={step} className="flex-1 flex flex-col items-center text-center relative">
              {index > 0 && (
                <div className={`absolute top-4 md:top-5 -left-1/2 w-full h-0.5 ${isComplete ? 'bg-primary' : 'bg-border'}`} />
              )}
              <div className={`relative z-10 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                isComplete ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border text-text-muted'
              }`}>
                {isComplete ? <CheckCircle className="w-4 h-4 md:w-5 md:h-5" /> : <span className="text-caption-md font-semibold">{index + 1}</span>}
              </div>
              <p className={`mt-2 text-caption-md md:text-body-sm font-medium ${isComplete ? 'text-text-primary' : 'text-text-muted'}`}>
                {formatCustomerStatusLabel(step)}
              </p>
            </div>
          );
        })}
      </div>

      {status === 'rescheduled' && (
        <div className="mt-4 p-3 bg-warning-background border border-warning-border rounded-control flex items-start gap-2">
          <CalendarClock className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-warning text-body-sm">Delivery Rescheduled</p>
            <p className="text-body-sm text-text-secondary">
              Your delivery timing has changed. Call us at 0809 653 9067 if you'd like to arrange a new time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
