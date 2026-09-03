/** STOREFRONT layer — looks up an order by order number + email/phone. */
'use client';

import { useState } from 'react';
import type { Order } from '@/types/order';
import { readFieldErrors, type FieldErrors } from '@/lib/api/field-errors';

export function useTrackOrder() {
  const [orderNumber, setOrderNumber] = useState('');
  const [contact, setContact] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** The form's field names match the API's, so no remapping is needed here. */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const fetchOrder = async () => {
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
        setFieldErrors(readFieldErrors(data));
        setError(data.error || 'Order not found');
      }
    } catch (err) {
      setError('Something went wrong. Please check your connection and try again.');
    }
  };

  const trackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFieldErrors({});
    setOrder(null);
    await fetchOrder();
    setLoading(false);
  };

  /** Re-fetches the same order in place — used after a change-request
   * submission/resolution so the tracked order reflects the latest state
   * without making the customer re-enter their order number/contact. */
  const refreshOrder = async () => {
    await fetchOrder();
  };

  const reset = () => {
    setOrder(null);
    setError('');
    setFieldErrors({});
  };

  return {
    orderNumber, setOrderNumber,
    contact, setContact,
    order, loading, error, fieldErrors,
    trackOrder, refreshOrder, reset,
  };
}
