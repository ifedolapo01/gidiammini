/** STOREFRONT layer — looks up an order by order number + email/phone. */
'use client';

import { useState } from 'react';
import type { Order } from '@/types/order';

export function useTrackOrder() {
  const [orderNumber, setOrderNumber] = useState('');
  const [contact, setContact] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const trackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setOrder(null);

    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, contact }),
      });
      const data = await res.json();

      if (data.success) {
        setOrder(data.order);
      } else {
        setError(data.error || 'Order not found');
      }
    } catch (err) {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOrder(null);
    setError('');
  };

  return {
    orderNumber, setOrderNumber,
    contact, setContact,
    order, loading, error,
    trackOrder, reset,
  };
}
