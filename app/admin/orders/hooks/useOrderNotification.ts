/** ADMIN layer — the free-text notification sent from the order details modal.
 * Split out of useOrders.ts, which is now a composition rather than a place
 * where behaviour lives. */
'use client';

import { useCallback, useState } from 'react';

type ShowToast = (message: string, type?: 'success' | 'error') => void;

export function useOrderNotification(showToast: ShowToast, onSent: () => void) {
  const [notificationMessage, setNotificationMessage] = useState('');
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);

  const sendCustomNotification = useCallback(
    async (orderId: string) => {
      if (!notificationMessage.trim()) {
        showToast('Please enter a message', 'error');
        return;
      }

      setSendingNotification(orderId);
      try {
        const response = await fetch(`/api/orders/${orderId}/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: notificationMessage, viaEmail: true, viaSMS: true }),
        });

        const result = await response.json().catch(() => null);

        if (response.ok && result?.success) {
          showToast(result.message || 'Notification sent.', 'success');
          setNotificationMessage('');
          onSent();
        } else {
          // The route answers 502 with a human-readable reason when nothing
          // could be delivered, e.g. "Nothing sent — SMS not configured".
          showToast(result?.error || 'Failed to send notification', 'error');
        }
      } catch (error) {
        console.error('Error sending notification:', error);
        showToast('Error sending notification', 'error');
      } finally {
        setSendingNotification(null);
      }
    },
    [notificationMessage, showToast, onSent]
  );

  return { notificationMessage, setNotificationMessage, sendingNotification, sendCustomNotification };
}
