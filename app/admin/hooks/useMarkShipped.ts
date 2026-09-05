/**
 * ADMIN layer — "this one went out", from wherever the operator noticed.
 *
 * The one inline action the worklist offers. It goes through the same
 * PUT /api/orders/[id] the orders page uses, so the customer is notified, the
 * status history is written and the change is attributed exactly as it would
 * be from the dropdown — the shortcut is the tap, not the bookkeeping.
 *
 * Deliberately narrow. A general "set any status from anywhere" helper would
 * be the same three lines and would invite cancelling an order from a
 * dashboard row, where the reason dialog is not.
 *
 * It also skips the courier prompt the orders page shows on this transition,
 * so an order shipped from here carries no waybill and its customer gets the
 * shipping email without one. That is the trade the shortcut makes: it exists
 * for the parcel already out of the door and noticed late, and stopping to
 * open a dialog would defeat it. The waybill can be added afterwards on the
 * order's Tracking card, which does not re-notify.
 */
'use client';

import { useCallback, useState } from 'react';
import { notifyOrdersChanged } from '../lib/orderEvents';
import { useToast } from './useToast';

export function useMarkShipped(onShipped?: () => void | Promise<void>) {
  const { showToast } = useToast();
  const [shippingId, setShippingId] = useState<string | null>(null);

  const markShipped = useCallback(
    async (orderId: string, orderNumber: string) => {
      setShippingId(orderId);

      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'shipped',
            sendNotification: true,
            notificationMessage: 'Your order has shipped and is on its way.',
          }),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          showToast(result?.error || `Could not mark ${orderNumber} shipped.`, 'error');
          return;
        }

        showToast(`${orderNumber} marked shipped — the customer has been told.`);
        notifyOrdersChanged();
        await onShipped?.();
      } catch {
        showToast('Could not reach the server. Nothing was changed.', 'error');
      } finally {
        setShippingId(null);
      }
    },
    [onShipped, showToast]
  );

  return { markShipped, shippingId };
}
