/** STOREFRONT layer — submits a customer reschedule / delivery-method-change
 * request. Reused by RescheduleRequestForm and DeliveryMethodChangeForm. */
'use client';

import { useState } from 'react';
import type { OrderChangeRequestType, RescheduleDetails, DeliveryMethodChangeDetails } from '@/types/orderChangeRequest';

interface SubmitChangeRequestParams {
  orderNumber: string;
  contact: string;
  requestType: OrderChangeRequestType;
  details: RescheduleDetails | DeliveryMethodChangeDetails;
  customerNote?: string;
}

export function useOrderChangeRequest() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submitChangeRequest = async (params: SubmitChangeRequestParams): Promise<boolean> => {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/orders/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();

      if (data.success) return true;

      setError(data.error || 'Something went wrong. Please try again.');
      return false;
    } catch (err) {
      setError('Something went wrong. Please check your connection and try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitChangeRequest, submitting, error };
}
