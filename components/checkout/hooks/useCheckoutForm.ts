/** STOREFRONT layer — checkout customer-details form state, and where it came from. */
'use client';

import { useState } from 'react';
import { useCheckoutPrefill } from './useCheckoutPrefill';
import { useAbandonedCartCapture } from './useAbandonedCartCapture';
import type { CartItem } from '@/types/order';

export interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  note: string;
  subscribeToNewsletter: boolean;
}

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
}

export function useCheckoutForm({ items, capture }: UseCheckoutFormArgs) {
  const [formData, setFormData] = useState<CheckoutFormData>(initialFormData);

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
