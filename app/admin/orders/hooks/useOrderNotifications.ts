/** ADMIN layer — the notification timeline for one order, and re-sending from it.
 *
 * Fetched when the History tab is opened rather than with the order. Most
 * orders are opened to check an address or move a status, and a second query
 * on every open to fill a panel nobody looked at is a query nobody asked for.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

export interface OrderNotification {
  id: string;
  channel: 'email' | 'sms';
  kind: string;
  recipient: string;
  subject: string | null;
  status: 'sent' | 'failed' | 'bounced' | 'delivered' | 'complained';
  failure_reason: string | null;
  failure_detail: string | null;
  provider_message_id: string | null;
  actor_id: string | null;
  resend_of: string | null;
  created_at: string;
}

export function useOrderNotifications(
  orderId: string,
  showToast: (message: string, type?: 'success' | 'error') => void
) {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [loading, setLoading] = useState(true);
  /** True when the table itself could not be read — an unapplied migration.
   *  Distinct from an empty timeline, which means nothing was ever sent. */
  const [unavailable, setUnavailable] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/notifications`);
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) throw new Error(data?.error || 'Failed to load');

      setNotifications(data.notifications ?? []);
      setUnavailable(Boolean(data.unavailable));
    } catch (error) {
      console.error('Error loading notification timeline:', error);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const resend = useCallback(
    async (notificationId: string) => {
      setResendingId(notificationId);
      try {
        const response = await fetch(`/api/orders/${orderId}/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId }),
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
          showToast(data?.error || 'Could not send that again.', 'error');
          return;
        }

        showToast(data.message || 'Sent again.');
        // Reloaded rather than optimistically appended: the new row's status
        // is the server's to decide, and a timeline that shows "sent" for
        // something the mail server refused is the exact failure this whole
        // feature exists to end.
        await load();
      } catch (error) {
        console.error('Error resending notification:', error);
        showToast('Could not send that again.', 'error');
      } finally {
        setResendingId(null);
      }
    },
    [orderId, load, showToast]
  );

  return { notifications, loading, unavailable, resendingId, resend, reload: load };
}
