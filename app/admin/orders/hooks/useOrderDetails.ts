/** ADMIN layer — the order behind the details modal.
 *
 * The list no longer carries order_status_history or the full change-request
 * rows: embedding them on every row meant every order ever placed shipped its
 * whole history on every poll. The modal fetches the one order it is showing,
 * which is one small query for a panel somebody deliberately opened.
 */
'use client';

import { useCallback, useState } from 'react';
import { Order } from '@/types/order';

type ShowToast = (message: string, type?: 'success' | 'error') => void;

export function useOrderDetails(showToast: ShowToast) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadOrder = useCallback(async (orderId: string): Promise<Order | null> => {
    const response = await fetch(`/api/orders/${orderId}`);
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'Failed to load order');
    }
    return result.order as Order;
  }, []);

  const openOrderDetails = useCallback(
    async (order: Pick<Order, 'id'>) => {
      setDetailsLoading(true);
      try {
        const full = await loadOrder(order.id);
        setSelectedOrder(full);
      } catch (error: any) {
        console.error('Error loading order details:', error);
        showToast(error.message || 'Could not open this order.', 'error');
      } finally {
        setDetailsLoading(false);
      }
    },
    [loadOrder, showToast]
  );

  /** Re-reads the open order after a mutation made from inside the modal. */
  const refreshSelectedOrder = useCallback(async () => {
    const current = selectedOrder;
    if (!current) return;
    try {
      setSelectedOrder(await loadOrder(current.id));
    } catch (error) {
      console.error('Error refreshing order details:', error);
    }
  }, [selectedOrder, loadOrder]);

  return {
    selectedOrder,
    detailsLoading,
    openOrderDetails,
    closeOrderDetails: useCallback(() => setSelectedOrder(null), []),
    refreshSelectedOrder,
  };
}
