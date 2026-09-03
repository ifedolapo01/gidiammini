/**
 * STOREFRONT layer — posting a product question.
 *
 * Field errors come back in the shape parse-body.ts produces, so the form can
 * put each message under the input that caused it rather than in a toast that
 * has to name the field in prose.
 *
 * `done` is deliberately terminal: after a successful ask the form is replaced
 * by the confirmation rather than reset. Somebody who has just asked a
 * question is not about to ask a second one, and an empty form under a "thanks,
 * we'll email you" message invites exactly the duplicate the moderator then
 * has to deal with.
 */
'use client';

import { useState } from 'react';
import type { FieldErrors } from '@/lib/api/field-errors';

export interface QuestionDraft {
  productId: string;
  question: string;
  name: string;
  email: string;
  /** The honeypot's value — sent, because a hidden input nobody reads is
   *  decoration rather than a check. */
  website: string;
}

export function useAskQuestion() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  async function ask(draft: QuestionDraft): Promise<boolean> {
    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || 'We could not send your question. Please try again.');
        setFieldErrors(result?.fieldErrors ?? {});
        return false;
      }

      setMessage(result.message ?? "Thanks — we've got your question.");
      setDone(true);
      return true;
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { ask, submitting, error, fieldErrors, done, message };
}
