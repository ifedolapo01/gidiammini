/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The sign-in box.
//
// One field, because asking "was it your email or your phone?" is asking the
// customer to remember something about our database. The server works out
// which it is.
//
// After a successful request the form is replaced by the confirmation rather
// than reset: the next step is in their inbox, not on this page, and an empty
// box under "we sent you a link" invites a second request.
'use client';

import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { Button, FieldError, Input, fieldErrorId } from '@/components/ui';
import { MAX_CONTACT_LENGTH } from '@/lib/api/schemas/account';

export function SignInForm() {
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<{ message: string; sentTo?: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, website }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || 'We could not send that link. Please try again.');
        return;
      }

      setSent({ message: result.message, sentTo: result.sentTo });
    } catch {
      setError('We could not reach the server. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-surface border border-border bg-surface p-6 text-center">
        <MailCheck className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
        <p className="mt-3 text-body-md font-medium text-text-primary">Check your email</p>
        <p className="mt-2 text-body-sm text-text-secondary">
          {sent.sentTo ? `We sent a sign-in link to ${sent.sentTo}.` : sent.message}
        </p>
        <p className="mt-2 text-caption-md text-text-secondary">
          It works once and lasts 20 minutes. Check your spam folder if it has not
          arrived in a minute.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-surface border border-border bg-surface p-6">
      <label htmlFor="contact" className="mb-1 block text-body-sm font-medium text-text-primary">
        Email or phone number
      </label>
      <Input
        id="contact"
        value={contact}
        onChange={(event) => setContact(event.target.value)}
        maxLength={MAX_CONTACT_LENGTH}
        required
        autoComplete="email"
        placeholder="ada@example.com or 0806 123 4567"
        invalid={Boolean(error)}
        aria-describedby={error ? fieldErrorId('contact') : undefined}
        disabled={submitting}
      />
      <FieldError id={fieldErrorId('contact')}>{error}</FieldError>

      {/* The honeypot the API checks. Hidden from people, not from scripts. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="sr-only"
      />

      <Button type="submit" size="lg" loading={submitting} className="mt-4 w-full">
        Email me a sign-in link
      </Button>

      <p className="mt-3 text-caption-md text-text-secondary">
        The link goes to the email address on your order, whichever of the two you
        type here — so nobody can point it at an inbox that is not yours.
      </p>
    </form>
  );
}
