/** ADMIN layer — where an invited admin sets their password.
 *
 * The only admin page reachable without a session, because it is the page that
 * creates one. Everything it needs is in the URL the invitation email carried;
 * the token is proof of nothing until /api/admin/accept-invite says so, which
 * is why this file validates only what it can honestly validate — that the two
 * passwords match and are long enough.
 */
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { adminConfig } from '../../config';

/** Matches MIN_PASSWORD_LENGTH in the route. Checked here too so the person
 * finds out as they type rather than after a round trip. */
const MIN_LENGTH = 10;

export default function AcceptInviteForm() {
  const params = useSearchParams();
  const router = useRouter();

  const token = params.get('token') ?? '';
  const type = params.get('type') === 'recovery' ? 'recovery' : 'invite';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, type, password }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || 'Could not finish setting up your account.');
        return;
      }

      // The session cookies are already set by the route, so this lands on a
      // dashboard rather than bouncing back through the login form.
      router.push('/admin/dashboard');
      router.refresh();
    } catch {
      setError('Could not reach the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div role="alert" className="rounded-surface border border-destructive-border bg-destructive-background p-4">
        <p className="text-body-sm font-medium text-destructive">
          This link is missing its invitation code. Ask an owner to send a new invitation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="invite-password" className="mb-1 block text-body-sm font-medium text-text-primary">
          Choose a password
        </label>
        <div className="relative">
          <Input
            id="invite-password"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            aria-describedby="invite-password-hint"
            invalid={tooShort || Boolean(error)}
            autoFocus
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-primary"
          >
            {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        <p id="invite-password-hint" className="mt-1 text-caption-md text-text-secondary">
          At least {MIN_LENGTH} characters. This account is yours alone — everything
          you do is recorded against your name.
        </p>
      </div>

      <div>
        <label htmlFor="invite-confirm" className="mb-1 block text-body-sm font-medium text-text-primary">
          Type it again
        </label>
        <Input
          id="invite-confirm"
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          invalid={mismatch}
          required
        />
        {mismatch && (
          <p className="mt-1 text-caption-md text-destructive">The two passwords do not match.</p>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-control border border-destructive-border bg-destructive-background p-3">
          <p className="text-body-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        loading={loading}
        disabled={tooShort || mismatch || password.length === 0}
        className="w-full font-semibold"
      >
        {loading ? 'Setting up your account…' : `Enter ${adminConfig.brandName}`}
      </Button>
    </form>
  );
}

export function AcceptInviteHeader() {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary/10">
        <KeyRound size={22} className="text-primary" aria-hidden="true" />
      </div>
      <h1 className="text-h4 font-bold text-text-primary">{adminConfig.brandName}</h1>
      <p className="mt-1 text-body-sm text-text-secondary">
        You have been invited. Set a password to finish.
      </p>
    </div>
  );
}

export function AcceptInviteFooter() {
  return (
    <p className="mt-6 flex items-center justify-center gap-1.5 text-body-sm text-text-muted">
      <ShieldCheck size={14} aria-hidden="true" />
      Restricted access — authorized personnel only
    </p>
  );
}
