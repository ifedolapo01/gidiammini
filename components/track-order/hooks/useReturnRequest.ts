/** STOREFRONT layer — submits a customer return request to
 * /api/orders/returns. Split from useOrderChangeRequest.ts now that a return
 * is its own resource (types/return.ts) rather than one of the eight
 * order_change_requests types — see lib/commerce/returns.ts for why. */
'use client';

import { useState } from 'react';
import { readFieldErrors, mapFieldErrors, type FieldErrors } from '@/lib/api/field-errors';

interface SubmitReturnParams {
  orderNumber: string;
  contact: string;
  reason: string;
  items: Array<{ orderItemId: string; quantity: number }>;
}

export function useReturnRequest() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const submitReturnRequest = async (params: SubmitReturnParams): Promise<boolean> => {
    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      const res = await fetch('/api/orders/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();

      if (data.success) return true;

      // Server field names already match this form's own field names
      // (reason, items) — nothing to remap, unlike the eight-type change
      // request schema this replaces.
      setFieldErrors(mapFieldErrors(readFieldErrors(data), {}));
      setError(data.error || 'Something went wrong. Please try again.');
      return false;
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitReturnRequest, submitting, error, fieldErrors };
}
