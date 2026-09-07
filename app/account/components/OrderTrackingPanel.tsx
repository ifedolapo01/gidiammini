/** STOREFRONT layer — the full tracking view, expanded inline under an order
 *  on the account page.
 *
 * Reuses the exact same lookup and summary the guest track-order flow uses —
 * the signed-in session already knows this order is the customer's, so the
 * contact it sends is their own verified email, never typed. No second
 * definition of "what a tracked order looks like" to keep in sync with the
 * guest page's.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Order } from '@/types/order';
import TrackedOrderSummary from '@/components/track-order/TrackedOrderSummary';

interface OrderTrackingPanelProps {
  orderNumber: string;
  contact: string;
}

export default function OrderTrackingPanel({ orderNumber, contact }: OrderTrackingPanelProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrder = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, contact }),
      });
      const data = await response.json();

      if (data.success) {
        setOrder(data.order);
        setError('');
      } else {
        setError(data.error || 'Could not load this order.');
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    }
  }, [orderNumber, contact]);

  // Fetched on mount rather than on the click that expanded this panel: it is
  // only ever mounted once expanded, so mounting already is the trigger, and
  // `loading` already starts true — nothing to set before the fetch begins.
  useEffect(() => {
    fetchOrder().finally(() => setLoading(false));
  }, [fetchOrder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-body-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading order details…
      </div>
    );
  }

  if (error || !order) {
    return (
      <p className="py-6 text-center text-body-sm text-destructive">
        {error || 'Could not load this order.'}
      </p>
    );
  }

  return <TrackedOrderSummary order={order} orderNumber={orderNumber} contact={contact} onOrderUpdate={fetchOrder} />;
}
