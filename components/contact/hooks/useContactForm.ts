/** STOREFRONT layer — submits the public Contact Us form. */
'use client';

import { useState } from 'react';
import { readFieldErrors, type FieldErrors } from '@/lib/api/field-errors';

interface ContactFormParams {
  name: string;
  email: string;
  phone?: string;
  message: string;
  /** Honeypot value. Sent through so the server can discard bot submissions;
   * a real person can never populate it. */
  website?: string;
}

export function useContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  /** The form's field names match the API's, so no remapping is needed here. */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const submitContactForm = async (params: ContactFormParams): Promise<boolean> => {
    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
        return true;
      }

      setFieldErrors(readFieldErrors(data));
      setError(data.error || 'Something went wrong. Please try again.');
      return false;
    } catch (err) {
      setError('Something went wrong. Please check your connection and try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitContactForm, submitting, error, fieldErrors, submitted };
}
