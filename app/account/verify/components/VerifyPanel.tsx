/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The "yes, it's me" button, and what happens after it.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui';

interface VerifyPanelProps {
  token: string;
}

export function VerifyPanel({ token }: VerifyPanelProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/account/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || 'We could not sign you in. Please ask for a new link.');
        return;
      }

      // replace, not push: the URL holds a spent token and there is no reason
      // for the back button to return to it.
      router.replace('/account');
    } catch {
      setError('We could not reach the server. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-surface border border-border bg-surface p-6 text-center">
        <h1 className="text-h5 font-bold text-text-primary">That link is incomplete</h1>
        <p className="mt-2 text-body-sm text-text-secondary">
          It may have been cut off by your email app. Ask for a fresh one and open it
          in one tap.
        </p>
        <Button className="mt-4" onClick={() => router.push('/account/login')}>
          Get a new link
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-surface border border-border bg-surface p-6 text-center">
      <h1 className="text-h5 font-bold text-text-primary">One more tap</h1>
      <p className="mt-2 text-body-sm text-text-secondary">
        Press the button to open your orders. We ask rather than doing it
        automatically because email apps sometimes open links on your behalf, and
        this one only works once.
      </p>

      {error ? (
        <>
          <p role="alert" className="mt-4 text-body-sm text-destructive">
            {error}
          </p>
          <Link
            href="/account/login"
            className="mt-4 inline-flex text-body-md font-medium text-primary underline-offset-4 hover:underline"
          >
            Ask for a new link →
          </Link>
        </>
      ) : (
        <Button size="lg" loading={submitting} onClick={signIn} className="mt-4 w-full">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Sign in
        </Button>
      )}
    </div>
  );
}
