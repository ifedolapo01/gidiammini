/** ADMIN layer — wires the notification timeline to its data.
 *
 * A thin bridge so OrderDetailsModal stays a shell over tabs and does not gain
 * a fourth hook, and so the timeline component itself stays presentation-only
 * and testable with fixtures.
 */
'use client';

import type { Order } from '@/types/order';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import OrderNotificationTimeline from './OrderNotificationTimeline';

export default function OrderNotificationsTab({
  order,
  showToast,
}: {
  order: Order;
  showToast: (message: string, type?: 'success' | 'error') => void;
}) {
  const { notifications, loading, unavailable, resendingId, resend } = useOrderNotifications(
    order.id,
    showToast
  );

  return (
    <OrderNotificationTimeline
      notifications={notifications}
      loading={loading}
      unavailable={unavailable}
      resendingId={resendingId}
      onResend={resend}
    />
  );
}
