/**
 * STOREFRONT layer — the footer newsletter signup.
 *
 * Was an input and an arrow with no state, no handler and no submit: a visitor
 * could type their address, press the arrow, and get neither feedback nor a
 * subscription. /api/subscribe already existed and worked.
 *
 * One field. The checkout opt-in sends a name because it already has one; here
 * a second box on the most-seen form on the site would cost more subscribers
 * than the greeting in the welcome email is worth, so the API treats the name
 * as optional and the email greets "Hi there".
 */
'use client';

import { useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Spinner, fieldErrorId } from '@/components/ui';
import { useNewsletterSignup } from './hooks/useNewsletterSignup';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  /** Honeypot — must stay empty for a real submission. */
  const [website, setWebsite] = useState('');
  const { subscribe, submitting, error, fieldErrors, submitted } = useNewsletterSignup();

  // One line for both: the server sends a per-field message when the address
  // itself is the problem and a general one otherwise, and the form has room
  // for exactly one.
  const message = fieldErrors.email || error;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await subscribe({ email: email.trim(), website });
    if (ok) {
      setEmail('');
      setWebsite('');
    }
  };

  // The footer is a fixed dark surface in both themes (--surface-inverse is
  // never redefined), so the status colours would fail contrast in one theme
  // or the other. The icon carries the meaning instead — which is what WCAG
  // asks for anyway: never colour alone.
  if (submitted) {
    return (
      <div className="flex items-start gap-2 text-on-inverse">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold text-body-sm md:text-body-md">You&apos;re on the list</p>
          <p className="text-on-inverse/70 text-body-sm">
            Look out for an email — offers land there first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Honeypot. Hidden from sight AND from assistive tech, and taken out of
          the tab order, so no real person can reach it — anything submitted in
          it came from a bot filling every input on the page. See
          isBotSubmission in app/api/subscribe/route.ts. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="flex">
        <input
          id="newsletter-email"
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Your email"
          autoComplete="email"
          required
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? fieldErrorId('email') : undefined}
          className="flex-1 min-w-0 px-3 md:px-4 py-2 rounded-l-control bg-surface text-text-primary text-body-sm md:text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={submitting}
          aria-label="Subscribe to the newsletter"
          className="bg-primary text-primary-foreground px-3 md:px-4 py-2 rounded-r-control text-body-sm md:text-body-md hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:pointer-events-none"
        >
          {submitting ? (
            <Spinner size="sm" label="Subscribing" />
          ) : (
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Not <FieldError>: its text-destructive is the wrong colour on this
          fixed dark surface, and cn() is a plain join, so overriding it would
          leave two colour classes and let stylesheet order decide. */}
      {message && (
        <p
          id={fieldErrorId('email')}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-caption-md md:text-body-sm text-on-inverse"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
    </form>
  );
}
