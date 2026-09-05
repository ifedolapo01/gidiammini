/** ADMIN layer — per-order shipping override mutation, split out of
 * useOrders.ts to keep that file under the project's line-count cap.
 *
 * Takes a reconcile callback rather than the list's setState: the list is
 * server-paged now, so patching a local array would leave the row disagreeing
 * with the page the next poll fetches. */
'use client';

import { useState } from 'react';
import { describeDelivery } from '@/lib/notifications/delivery';

interface UseOrderShippingUpdateParams {
  /** Re-reads the list and the open order from the server. */
  onUpdated: () => void | Promise<void>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function useOrderShippingUpdate({ onUpdated, showToast }: UseOrderShippingUpdateParams) {
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
        await onUpdated();
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
