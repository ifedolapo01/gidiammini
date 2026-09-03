/**
 * STOREFRONT layer — "email me when it's back".
 *
 * The moment someone finds a sold-out product is the moment they are most
 * willing to leave an address, and the least willing to fill in a form. So:
 * one field, one button, and no account.
 *
 * The reply is deliberately the same whether the address was new or already
 * waiting. The API answers that way on purpose — distinguishing them would let
 * anyone test an address against a product — and the UI must not undo it by
 * saying something more specific.
 */
'use client';

import { useId, useState } from 'react';
import { BellRing, Check } from 'lucide-react';
import { Button, Input, FieldError, fieldErrorId } from '@/components/ui';

interface BackInStockFormProps {
  productId: string;
  /** The variant they were looking at, when the page knows one. */
  variantKey?: string | null;
}

export default function BackInStockForm({ productId, variantKey }: BackInStockFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === 'sending') return;

    setStatus('sending');
    setError(null);

    try {
      const response = await fetch('/api/stock-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, productId, variantKey: variantKey ?? null }),
      });
      const payload = await response.json();

      if (!payload.success) {
        setError(payload.error || 'We could not save that just now. Please try again.');
        setStatus('idle');
        return;
      }

      setStatus('done');
    } catch {
      setError('We could not reach the server. Please try again.');
      setStatus('idle');
    }
  }

  if (status === 'done') {
    return (
      <div
        // role="status" rather than an alert: this is a confirmation, and it
        // should be announced without interrupting.
        role="status"
        className="flex items-start gap-2 rounded-control border border-success-border bg-success-background p-3"
      >
        <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        <p className="text-body-sm text-success">
          You&apos;re on the list. We&apos;ll email you the moment it&apos;s back — once, for this
          product only.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId} className="mb-1.5 flex items-center gap-1.5 text-body-sm font-medium text-text-primary">
        <BellRing className="size-4" aria-hidden="true" />
        Email me when it&apos;s back
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          invalid={Boolean(error)}
          aria-describedby={error ? fieldErrorId(inputId) : undefined}
          className="flex-1"
        />
        {/* The button reports its own pending state; without it a slow network
            reads as a dead form and gets pressed again. */}
        <Button type="submit" variant="primary" size="md" loading={status === 'sending'}>
          Notify me
        </Button>
      </div>

      <FieldError id={fieldErrorId(inputId)}>{error ?? undefined}</FieldError>

      <p className="mt-2 text-caption-md text-text-muted">
        One email about this product. We won&apos;t add you to anything else.
      </p>
    </form>
  );
}
