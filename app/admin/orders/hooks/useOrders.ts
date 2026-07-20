/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/hooks/useOrders.ts
'use client';

import { useState, useEffect } from 'react';
import { Order } from '@/types/order';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const [updatingShipping, setUpdatingShipping] = useState(false);

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
      setRefreshing(false);
    }
  };

  const refreshOrders = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      // Show confirmation for certain status changes
      if (newStatus === 'cancelled') {
        if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
          return;
        }
      }

      console.log(`Updating order ${orderId} to status: ${newStatus}`);
      console.log(`Calling API: /api/orders/${orderId}`);

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          sendNotification: true,
          notificationMessage: `Your order status has been updated to: ${newStatus.toUpperCase()}`
          // payment_verified will be handled automatically by the API
        }),
      });

      console.log('Response status:', response.status);

      const result = await response.json();
      console.log('Update response:', result);

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

        // Show success message
        const message = result.paymentVerified
          ? `✅ Order confirmed! Payment marked as verified. Customer has been notified.`
          : `✅ Order status updated to ${newStatus}. Customer has been notified.`;

        alert(message);
      } else {
        console.error('Update failed:', result);
        alert(`❌ Failed to update order status: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error updating order:', error);
      alert(`❌ Error updating order: ${error.message || 'Please check your connection.'}`);
    }
  };

  const sendCustomNotification = async (orderId: string) => {
    if (!notificationMessage.trim()) {
      alert('Please enter a message');
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
          alert('Notification sent successfully!');
          setNotificationMessage('');
          setSelectedOrder(null);
        } else {
          alert(`Failed to send notification: ${result.error}`);
        }
      } else {
        alert('Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Error sending notification');
    } finally {
      setSendingNotification(null);
    }
  };

  const updateOrderShipping = async (orderId: string, shippingZoneId: string, deliveryOption: 'pickup' | 'delivery') => {
    try {
      setUpdatingShipping(true);
      const response = await fetch(`/api/orders/${orderId}/shipping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipping_zone_id: shippingZoneId, delivery_option: deliveryOption }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setOrders(prevOrders =>
          prevOrders.map(order => (order.id === orderId ? { ...order, ...result.order } : order))
        );
        setSelectedOrder(prev => (prev && prev.id === orderId ? { ...prev, ...result.order } : prev));
        alert('Shipping method updated. Customer has been notified.');
      } else {
        alert(`Failed to update shipping method: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error updating order shipping:', error);
      alert(`Error updating shipping method: ${error.message || 'Please check your connection.'}`);
    } finally {
      setUpdatingShipping(false);
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
    refreshing,
    refreshOrders,
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
  };
}
