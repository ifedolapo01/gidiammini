/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/hooks/useOrders.ts
'use client';

import { useState, useEffect } from 'react';
import { Order } from '@/types/order';
import { formatOrderStatus } from '@/lib/commerce/order-status';
import { notifyOrdersChanged } from '../../lib/orderEvents';
import { useToast } from '../../hooks/useToast';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';
import { useOrderShippingUpdate } from './useOrderShippingUpdate';
import { useOrderChangeRequests } from './useOrderChangeRequests';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const { showToast } = useToast();
  const { updateOrderShipping, updatingShipping } = useOrderShippingUpdate({ setOrders, setSelectedOrder, showToast });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      } else {
        console.error('Failed to fetch orders');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  /** Reconciles with the server without toggling `loading` — used right after
   * a mutation, and on a background poll, so the list stays fully accurate
   * (payment_verified, updated_at, new orders placed elsewhere, etc.) without
   * flashing a loading state over data already showing on screen. */
  const syncOrdersSilently = async () => {
    try {
      const response = await fetch('/api/orders');
      if (response.ok) {
        const data = await response.json();
        const freshOrders: Order[] = data.orders || [];
        setOrders(freshOrders);
        setSelectedOrder((prev) => (prev ? freshOrders.find((o) => o.id === prev.id) || prev : prev));
      }
    } catch (error) {
      console.error('Error syncing orders:', error);
    }
  };

  // New orders can arrive from a customer's own browser session at any time,
  // with nothing to notify this tab — so poll periodically instead of only
  // relying on notifyOrdersChanged(), which only fires for actions taken here.
  useEffect(() => {
    const interval = setInterval(syncOrdersSilently, ADMIN_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { resolveChangeRequest, resolvingRequestId } = useOrderChangeRequests({ syncOrdersSilently, showToast });

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      // Show confirmation for certain status changes
      if (newStatus === 'cancelled') {
        if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
          return;
        }
      }

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          sendNotification: true,
          notificationMessage: `Your order status has been updated to: ${formatOrderStatus(newStatus)}`
          // payment_verified will be handled automatically by the API
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update local state immediately for better UX
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId
              ? {
                  ...order,
                  status: newStatus,
                  // Update payment status if it was auto-verified
                  payment_verified: result.paymentVerified || order.payment_verified
                }
              : order
          )
        );

        // Let other admin views (e.g. the pending-orders alert count) know to refetch,
        // then reconcile this list with the server's authoritative state.
        notifyOrdersChanged();
        syncOrdersSilently();

        const message = result.paymentVerified
          ? 'Order confirmed! Payment marked as verified. Customer has been notified.'
          : `Order status updated to ${formatOrderStatus(newStatus)}. Customer has been notified.`;

        showToast(message, 'success');
      } else {
        console.error('Update failed:', result);
        showToast(`Failed to update order status: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error: any) {
      console.error('Error updating order:', error);
      showToast(`Error updating order: ${error.message || 'Please check your connection.'}`, 'error');
    }
  };

  const sendCustomNotification = async (orderId: string) => {
    if (!notificationMessage.trim()) {
      showToast('Please enter a message', 'error');
      return;
    }

    try {
      setSendingNotification(orderId);
      const response = await fetch(`/api/orders/${orderId}/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: notificationMessage,
          viaEmail: true,
          viaSMS: true
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showToast('Notification sent successfully!', 'success');
          setNotificationMessage('');
          setSelectedOrder(null);
        } else {
          showToast(`Failed to send notification: ${result.error}`, 'error');
        }
      } else {
        showToast('Failed to send notification', 'error');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      showToast('Error sending notification', 'error');
    } finally {
      setSendingNotification(null);
    }
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
  };

  const closeOrderDetails = () => {
    setSelectedOrder(null);
  };

  return {
    orders,
    loading,
    updateOrderStatus,
    selectedOrder,
    openOrderDetails,
    closeOrderDetails,
    sendingNotification,
    sendCustomNotification,
    notificationMessage,
    setNotificationMessage,
    updateOrderShipping,
    updatingShipping,
    resolveChangeRequest,
    resolvingRequestId,
  };
}
