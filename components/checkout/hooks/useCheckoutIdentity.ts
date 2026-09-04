/**
 * STOREFRONT layer — who is checking out.
 *
 * Three states, and the middle one matters: until the answer comes back we do
 * not know, and rendering the guest prompt during that moment would flash a
 * "sign in?" screen at somebody who is already signed in. So 'checking' is a
 * state the page waits on rather than a falsy default.
 *
 * `continueAsGuest` is deliberately not persisted. It lasts as long as this
 * checkout does; a shopper who comes back tomorrow is offered the choice
 * again, because by then they may well have an account — placing the order
 * created one.
 */
'use client';

import { useEffect, useState } from 'react';

export type IdentityStatus = 'checking' | 'guest' | 'signed-in';

export function useCheckoutIdentity() {
  const [status, setStatus] = useState<IdentityStatus>('checking');
  const [email, setEmail] = useState<string | null>(null);
  const [asGuest, setAsGuest] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/account/session', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        setStatus(result?.signedIn ? 'signed-in' : 'guest');
        setEmail(result?.email ?? null);
      })
      .catch(() => {
        // Offline or aborted. Treated as a guest: the worst case is one extra
        // screen, where the alternative is a checkout that never renders.
        setStatus('guest');
      });

    return () => controller.abort();
  }, []);

  return {
    status,
    email,
    /** True once the shopper may see the checkout form itself. */
    ready: status === 'signed-in' || asGuest,
    continueAsGuest: () => setAsGuest(true),
  };
}
