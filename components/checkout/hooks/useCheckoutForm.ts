/** STOREFRONT layer — checkout customer-details form state, and where it came from. */
'use client';

import { useState } from 'react';
import { useCheckoutPrefill } from './useCheckoutPrefill';

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

export function useCheckoutForm() {
  const [formData, setFormData] = useState<CheckoutFormData>(initialFormData);

  // A signed-in customer's last order fills the empty fields. It lives here
  // rather than in the page because "what is in this form" and "what was it
  // seeded from" are one concern, and the page should not have to wire two
  // hooks together to get a filled-in form.
  const prefill = useCheckoutPrefill(setFormData);

  const updateField = <K extends keyof CheckoutFormData>(field: K, value: CheckoutFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return { formData, setFormData, updateField, prefill };
}
