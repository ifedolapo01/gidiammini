/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/unsubscribe/page.tsx — the page the footer link lands on.
//
// One button, no sign-in, no survey, no "are you sure you want to miss out".
// Somebody who has decided to leave a mailing list and is made to work for it
// clicks "report spam" instead, and a spam complaint costs the shop its
// ability to reach everybody who did want to hear from it.
//
// The click is required rather than unsubscribing on page load: mail clients
// and corporate link scanners fetch every URL in an email, and a page that
// acted on GET would quietly opt people out of lists they still read. See the
// route's header.
'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Spinner } from '@/components/ui';

type State =
  | { phase: 'checking' }
  | { phase: 'ready'; email: string }
  | { phase: 'done'; email: string }
  | { phase: 'invalid'; message: string };

function UnsubscribeCard() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const token = params.get('t') ?? '';
  const query = `id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`;

  const [state, setState] = useState<State>({ phase: 'checking' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch(`/api/unsubscribe?${query}`);
        const data = await response.json().catch(() => null);
        if (!active) return;

        if (!response.ok || !data?.success) {
          setState({ phase: 'invalid', message: data?.error ?? 'That link is not valid.' });
          return;
        }

        setState(
          data.alreadyUnsubscribed
            ? { phase: 'done', email: data.email }
            : { phase: 'ready', email: data.email }
        );
      } catch {
        if (active) {
          setState({ phase: 'invalid', message: 'We could not check that link. Please try again.' });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [query]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/unsubscribe?${query}`, { method: 'POST' });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        setState({ phase: 'invalid', message: data?.error ?? 'We could not complete that. Please try again.' });
        return;
      }

      setState({ phase: 'done', email: data.email });
    } catch {
      setState({ phase: 'invalid', message: 'We could not complete that. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (state.phase === 'checking') {
    return (
      <p className="flex items-center justify-center gap-3 text-text-secondary py-8">
        <Spinner size="sm" />
        Checking your link…
      </p>
    );
  }

  if (state.phase === 'invalid') {
    return (
      <>
        <h1 className="text-h5 font-bold text-text-primary mb-2">We could not use that link</h1>
        <p className="text-text-secondary mb-6">{state.message}</p>
        <p className="text-body-sm text-text-secondary">
          If you keep getting emails you did not ask for, reply to any of them and a person will
          take you off the list.
        </p>
      </>
    );
  }

  if (state.phase === 'done') {
    return (
      <>
        <h1 className="text-h5 font-bold text-text-primary mb-2">You are unsubscribed</h1>
        <p className="text-text-secondary mb-6">
          We will not send offers to <strong className="text-text-primary">{state.email}</strong> again.
          You will still get emails about any order you place — those are not marketing.
        </p>
        <Link
          href="/"
          className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-control font-semibold hover:bg-primary-hover"
        >
          Back to the shop
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-h5 font-bold text-text-primary mb-2">Unsubscribe from offers?</h1>
      <p className="text-text-secondary mb-6">
        We will stop sending sale announcements to{' '}
        <strong className="text-text-primary">{state.email}</strong>. Emails about orders you place
        will still reach you.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={confirm} loading={submitting}>
          Unsubscribe
        </Button>
        <Link
          href="/"
          className="inline-flex items-center border border-border px-4 py-2 rounded-control font-semibold hover:bg-surface-hover"
        >
          Keep them coming
        </Link>
      </div>
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-surface border border-border bg-surface p-6 shadow-elevation-1">
        {/* useSearchParams needs a Suspense boundary for the static shell. */}
        <Suspense fallback={<p className="text-text-secondary py-8">Loading…</p>}>
          <UnsubscribeCard />
        </Suspense>
      </div>
    </div>
  );
}
