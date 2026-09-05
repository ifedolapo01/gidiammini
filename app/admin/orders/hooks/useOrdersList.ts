/** ADMIN layer — the orders list itself: query state, one page of rows, the
 * totals above it, and the single-order status change.
 *
 * Everything the page used to do in the browser over the full order history —
 * filter, search, count, sum — is now a query parameter. What the browser
 * holds is one page.
 */
'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Order } from '@/types/order';
import { formatOrderStatus } from '@/lib/commerce/order-status';
import { describeDelivery, anyDelivered } from '@/lib/notifications/delivery';
import type { AdminOrdersSummary } from '@/lib/commerce/admin-orders-summary';
import { notifyOrdersChanged } from '../../lib/orderEvents';
import { useListParams } from '../../hooks/useListParams';
import { useListData } from '../../hooks/useListData';
import { useListSummary } from '../../hooks/useListSummary';
import { useAdminRealtime } from '../../hooks/useAdminRealtime';

type ShowToast = (message: string, type?: 'success' | 'error') => void;

export function useOrdersList(showToast: ShowToast) {
  // The alerts ticker deep-links here as /admin/orders?filter=overdue, so the
  // status chip starts on whatever brought the operator to the page.
  const searchParams = useSearchParams();

  const params = useListParams({
    sort: 'created_at',
    direction: 'desc',
    filters: { status: searchParams?.get('filter') || 'all' },
  });

  const { items: orders, meta, loading, error, refreshSilently } = useListData<Order>(
    '/api/orders',
    params.queryString,
    'orders'
  );

  // Realtime on `orders` delivers "a row moved" the moment it happens; the
  // change-token poll behind it drops to a safety cadence but never stops, so
  // a dropped socket costs freshness rather than correctness. Neither path
  // reads order data from the browser — both just say "refetch".
  const { connected: live } = useAdminRealtime(['orders'], refreshSilently);

  const { summary, reloadSummary } = useListSummary<AdminOrdersSummary>(
    '/api/orders/summary',
    '',
    refreshSilently,
    live
  );

  /** Reconcile both the page and the totals with the server. Used after every
   * mutation, so server-only effects (a new history row, an auto-verified
   * payment) are in place before a success toast implies "done". */
  const syncOrders = useCallback(async () => {
    await Promise.all([refreshSilently(), reloadSummary()]);
  }, [refreshSilently, reloadSummary]);

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: Order['status']) => {
      if (newStatus === 'cancelled') {
        if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
          return;
        }
      }

      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            sendNotification: true,
            notificationMessage: `Your order status has been updated to: ${formatOrderStatus(newStatus)}`,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          console.error('Update failed:', result);
          showToast(`Failed to update order status: ${result.error || 'Unknown error'}`, 'error');
          return;
        }

        notifyOrdersChanged();
        await syncOrders();

        // Say what actually went out. Claiming "Customer has been notified"
        // when SMS is unconfigured is how an operator ends up skipping the
        // follow-up call.
        const what = result.paymentVerified
          ? 'Order confirmed and payment verified.'
          : `Order status updated to ${formatOrderStatus(newStatus)}.`;
        const how = result.delivery ? describeDelivery(result.delivery) : 'No notification sent';

        showToast(
          `${what} ${how}.`,
          result.delivery && !anyDelivered(result.delivery) ? 'error' : 'success'
        );
      } catch (caught: any) {
        console.error('Error updating order:', caught);
        showToast(`Error updating order: ${caught.message || 'Please check your connection.'}`, 'error');
      }
    },
    [showToast, syncOrders]
  );

  return { params, orders, meta, loading, error, summary, live, syncOrders, updateOrderStatus };
}
