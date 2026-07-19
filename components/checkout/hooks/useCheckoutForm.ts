/** STOREFRONT layer — checkout customer-details form state. */
import { useState } from 'react';

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

  const updateField = <K extends keyof CheckoutFormData>(field: K, value: CheckoutFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return { formData, setFormData, updateField };
}
