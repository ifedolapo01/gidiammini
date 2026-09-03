/** STOREFRONT layer — submits a customer reschedule / delivery-method-change
 * request. Reused by RescheduleRequestForm and DeliveryMethodChangeForm. */
'use client';

import { useState } from 'react';
import type { OrderChangeRequestType, RescheduleDetails, DeliveryMethodChangeDetails, CancelDetails } from '@/types/orderChangeRequest';
import {
  readFieldErrors,
  mapFieldErrors,
  CHANGE_REQUEST_FIELD_MAP,
  type FieldErrors,
} from '@/lib/api/field-errors';

interface SubmitChangeRequestParams {
  orderNumber: string;
  contact: string;
  requestType: OrderChangeRequestType;
  details: RescheduleDetails | DeliveryMethodChangeDetails | CancelDetails;
  customerNote?: string;
}

export function useOrderChangeRequest() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const submitChangeRequest = async (params: SubmitChangeRequestParams): Promise<boolean> => {
    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      const res = await fetch('/api/orders/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();

      if (data.success) return true;

      setFieldErrors(mapFieldErrors(readFieldErrors(data), CHANGE_REQUEST_FIELD_MAP));
      setError(data.error || 'Something went wrong. Please try again.');
      return false;
    } catch (err) {
      setError('Something went wrong. Please check your connection and try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitChangeRequest, submitting, error, fieldErrors };
}
