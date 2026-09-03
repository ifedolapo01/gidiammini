/**
 * STOREFRONT layer — posting one review.
 *
 * One instance per item on the order, because each item is its own submit:
 * somebody who bought three things may well have an opinion about one of them,
 * and a single form that saves all three at once turns that into either three
 * reviews they did not mean to write or none at all.
 *
 * Field errors come back from the route in the shape parse-body.ts produces,
 * so the form can put the message under the input that caused it rather than
 * in a toast that has to name the field in prose.
 */
'use client';

import { useState } from 'react';
import type { FieldErrors } from '@/lib/api/field-errors';

export interface ReviewDraft {
  productId: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  photoPaths: string[];
  /** The honeypot input's value. Empty for every human; a filled one is
   *  accepted by the route and silently discarded, so the form must actually
   *  send it rather than merely render it. */
  website: string;
}

export function useReviewSubmit(token: string) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(draft: ReviewDraft): Promise<boolean> {
    // The one client-side check worth making: it is the only required field,
    // and a round trip to be told so is a round trip wasted.
    if (draft.rating < 1) {
      setFieldErrors({ rating: 'Please choose a star rating.' });
      return false;
    }

    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...draft }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || 'We could not save your review. Please try again.');
        setFieldErrors(result?.fieldErrors ?? {});
        return false;
      }

      setMessage(result.message ?? 'Thank you — your review is with us.');
      setDone(true);
      return true;
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, submitting, error, fieldErrors, done, message };
}
