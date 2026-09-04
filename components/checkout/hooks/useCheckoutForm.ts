/** STOREFRONT layer — checkout customer-details form state, and where it came from. */
'use client';

import { useState } from 'react';
import { useCheckoutPrefill } from './useCheckoutPrefill';
import { useAbandonedCartCapture } from './useAbandonedCartCapture';
import type { CartItem } from '@/types/order';
import type { CheckoutFormData } from '@/lib/commerce/checkout-draft';

// The shape moved to lib/commerce/checkout-draft.ts, which persists it across a
// refresh and so has to define it. Re-exported because seven files import it
// from here and none of them cares where it lives.
export type { CheckoutFormData };

const initialFormData: CheckoutFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  note: '',
  subscribeToNewsletter: false,
};

interface UseCheckoutFormArgs {
  /** The basket, for the abandoned-cart capture. */
  items: CartItem[];
  /** False once an order has been created — nothing left to abandon. */
  capture: boolean;
  /**
   * What the customer had already typed, when this page is a return to a
   * checkout in progress. Without it a restored payment screen would submit an
   * order with no name, email or address on it.
   */
  initial?: CheckoutFormData | null;
}

export function useCheckoutForm({ items, capture, initial }: UseCheckoutFormArgs) {
  const [formData, setFormData] = useState<CheckoutFormData>(initial ?? initialFormData);

  // A signed-in customer's last order fills the empty fields. It lives here
  // rather than in the page because "what is in this form" and "what was it
  // seeded from" are one concern, and the page should not have to wire two
  // hooks together to get a filled-in form.
  const prefill = useCheckoutPrefill(setFormData);

  // The other direction: once there is a valid email and a basket, the cart is
  // recorded so it can be recovered if they leave. Debounced and silent — see
  // useAbandonedCartCapture.
  useAbandonedCartCapture({ formData, items, active: capture });

  const updateField = <K extends keyof CheckoutFormData>(field: K, value: CheckoutFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return { formData, setFormData, updateField, prefill };
}
