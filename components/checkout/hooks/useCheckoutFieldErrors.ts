/**
 * STOREFRONT layer — holds the per-field validation messages the server sent
 * back for a checkout submission.
 *
 * The order is created from the payment step, but the fields it validates live
 * on the details step, which is no longer on screen by then. So a rejection has
 * to do two things: keep the message against the right input, and send the
 * customer back to where that input is. This hook owns the first half; the page
 * changes the step.
 */
'use client';

import { useCallback, useState } from 'react';
import {
  readFieldErrors,
  mapFieldErrors,
  CHECKOUT_FIELD_MAP,
  type FieldErrors,
} from '@/lib/api/field-errors';

export function useCheckoutFieldErrors() {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  /** Records what the server rejected. Returns whether it named any field —
   * the caller uses that to decide between highlighting inputs and falling
   * back to a plain error message. */
  const captureFieldErrors = useCallback((body: unknown): boolean => {
    const mapped = mapFieldErrors(readFieldErrors(body), CHECKOUT_FIELD_MAP);
    setFieldErrors(mapped);
    return Object.keys(mapped).length > 0;
  }, []);

  const clearFieldErrors = useCallback(() => setFieldErrors({}), []);

  return { fieldErrors, captureFieldErrors, clearFieldErrors };
}
