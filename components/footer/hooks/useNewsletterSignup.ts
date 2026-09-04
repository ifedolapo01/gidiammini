/** STOREFRONT layer — submits the footer newsletter signup. */
'use client';

import { useState } from 'react';
import { readFieldErrors, type FieldErrors } from '@/lib/api/field-errors';

interface NewsletterSignupParams {
  email: string;
  /** Honeypot value. Sent through so the server can discard bot submissions;
   * a real person can never populate it. */
  website?: string;
}

/**
 * Same shape as useContactForm, deliberately: both are public forms that POST
 * once and then have something to say about it, and the footer's arrow button
 * had no state, no handler and no submit at all.
 *
 * No name field — see the footer form for why, and
 * 20260904120100_subscribers_optional_name.sql for the column that allows it.
 */
export function useNewsletterSignup() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  /** The form's field names match the API's, so no remapping is needed here. */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const subscribe = async (params: NewsletterSignupParams): Promise<boolean> => {
    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      const res = await fetch('/api/subscribe', {
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

  return { subscribe, submitting, error, fieldErrors, submitted };
}
