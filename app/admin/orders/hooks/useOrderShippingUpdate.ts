/** ADMIN layer — per-order shipping override mutation, split out of
 * useOrders.ts to keep that file under the project's line-count cap. */
'use client';

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Order } from '@/types/order';
import { describeDelivery } from '@/lib/notifications/delivery';

interface UseOrderShippingUpdateParams {
  setOrders: Dispatch<SetStateAction<Order[]>>;
  setSelectedOrder: Dispatch<SetStateAction<Order | null>>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function useOrderShippingUpdate({ setOrders, setSelectedOrder, showToast }: UseOrderShippingUpdateParams) {
  const [updatingShipping, setUpdatingShipping] = useState(false);

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
        const how = result.delivery ? describeDelivery(result.delivery) : 'No notification sent';
        showToast(`Shipping method updated. ${how}.`, 'success');
      } else {
        showToast(`Failed to update shipping method: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error: any) {
      console.error('Error updating order shipping:', error);
      showToast(`Error updating shipping method: ${error.message || 'Please check your connection.'}`, 'error');
    } finally {
      setUpdatingShipping(false);
    }
  };

  return { updateOrderShipping, updatingShipping };
}
