/** ADMIN layer — moving an order to a new status, including the two moves that
 * need more than a click.
 *
 * The dropdown used to fire PUT /api/orders/[id] immediately, with a
 * window.confirm in front of 'cancelled'. That confirm was doing two jobs
 * badly: it was the only guard on the most destructive action in the admin,
 * and it collected nothing — no ground, no note, nothing the shop could learn
 * from afterwards.
 *
 * So a transition is now a request that may need answering first. Cancelling
 * opens the reason dialog; shipping opens the courier dialog; everything else
 * still goes straight through, because adding a confirmation to "mark
 * confirmed" would only teach people to click past confirmations.
 *
 * The state machine is deliberately in a hook rather than in each surface: the
 * orders list, the details modal and the worklist all move orders, and three
 * copies of "which statuses need a dialog" is three chances for one of them to
 * skip it.
 */
'use client';

import { useCallback, useState } from 'react';
import type { Order, OrderStatus } from '@/types/order';
import { formatOrderStatus } from '@/lib/commerce/order-status';
import { describeDelivery, anyDelivered } from '@/lib/notifications/delivery';
import { notifyOrdersChanged } from '../../lib/orderEvents';

type ShowToast = (message: string, type?: 'success' | 'error') => void;

/** Everything a dialog can add to a transition. */
export interface TransitionExtras {
  reason_code?: string;
  reason?: string;
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  notify?: boolean;
}

export interface PendingTransition {
  order: Pick<Order, 'id' | 'order_number' | 'total_amount' | 'amount_paid' | 'amount_refunded'>;
  status: OrderStatus;
}

/** The statuses that cannot be applied without asking something first. */
const NEEDS_DIALOG: OrderStatus[] = ['cancelled', 'shipped'];

export function useStatusTransition(showToast: ShowToast, onApplied: () => Promise<void> | void) {
  const [pending, setPending] = useState<PendingTransition | null>(null);
  const [applying, setApplying] = useState(false);

  const apply = useCallback(
    async (orderId: string, status: OrderStatus, extras: TransitionExtras = {}) => {
      setApplying(true);
      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            sendNotification: extras.notify !== false,
            // Left out for a cancellation so the server writes the ground's own
            // customer-facing sentence rather than "your order status has been
            // updated to: Cancelled".
            notificationMessage: status === 'cancelled'
              ? undefined
              : `Your order status has been updated to: ${formatOrderStatus(status)}`,
            ...extras,
          }),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          showToast(result?.error || 'Failed to update order status.', 'error');
          return false;
        }

        notifyOrdersChanged();
        await onApplied();

        // Say what actually went out. Claiming "Customer has been notified"
        // when SMS is unconfigured is how an operator ends up skipping the
        // follow-up call.
        //
        // The verification flag is read off the returned order. It used to be
        // read from `result.paymentVerified`, which the endpoint has never
        // sent — so the "and payment verified" half of this sentence had
        // silently stopped appearing.
        const what = result.order?.payment_verified && status === 'confirmed'
          ? 'Order confirmed and payment verified.'
          : `Order status updated to ${formatOrderStatus(status)}.`;
        const how = result.delivery ? describeDelivery(result.delivery) : 'No notification sent';

        showToast(
          `${what} ${how}.`,
          result.delivery && !anyDelivered(result.delivery) ? 'error' : 'success'
        );
        return true;
      } catch (caught: any) {
        console.error('Error updating order:', caught);
        showToast(`Error updating order: ${caught.message || 'Please check your connection.'}`, 'error');
        return false;
      } finally {
        setApplying(false);
      }
    },
    [showToast, onApplied]
  );

  /**
   * Ask for a status change. Opens a dialog where the status needs one,
   * otherwise applies straight away.
   *
   * Takes the whole order rather than an id because the dialogs need it: the
   * cancel dialog cannot warn "this order has been paid for" without knowing
   * what has been paid.
   */
  const requestStatusChange = useCallback(
    (order: PendingTransition['order'], status: OrderStatus) => {
      if (NEEDS_DIALOG.includes(status)) {
        setPending({ order, status });
        return;
      }
      void apply(order.id, status);
    },
    [apply]
  );

  const confirmPending = useCallback(
    async (extras: TransitionExtras) => {
      if (!pending) return;
      const ok = await apply(pending.order.id, pending.status, extras);
      if (ok) setPending(null);
    },
    [pending, apply]
  );

  return {
    requestStatusChange,
    /** Applies without asking. For a surface that has already collected what it needs. */
    applyStatusChange: apply,
    pendingTransition: pending,
    confirmPending,
    dismissPending: useCallback(() => setPending(null), []),
    applyingTransition: applying,
  };
}
