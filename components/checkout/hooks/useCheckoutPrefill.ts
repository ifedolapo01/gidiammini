/**
 * STOREFRONT layer — filling checkout in from the customer's last order.
 *
 * The point of the whole account feature, from the customer's side: a repeat
 * buyer should not retype their name, phone and full delivery address on a
 * phone keyboard every time.
 *
 * Two rules make this safe to run automatically:
 *
 *   1. It only fills fields that are still empty. Typing has to win — a fetch
 *      that resolves a second after the customer started on the address must
 *      not overwrite what they wrote.
 *   2. It fills nothing at all when the request says "not signed in", which is
 *      the normal case. The 401 is expected and is not surfaced as an error.
 *
 * The state and LGA are left to useCheckoutShipping: they drive the zone
 * lookup and the delivery quote, so setting them from here would mean two
 * hooks racing to own the same selection. The saved state is returned instead,
 * for the page to offer.
 */
'use client';

import { useEffect, useState } from 'react';
import type { CheckoutFormData } from './useCheckoutForm';

export interface CheckoutPrefill {
  /** Set once a signed-in customer's details have been applied. */
  applied: boolean;
  email: string | null;
  /** The state on the last order, for the shipping step to preselect. */
  savedState: string | null;
}

type Setter = (update: (previous: CheckoutFormData) => CheckoutFormData) => void;

const FIRST_WORD = /^(\S+)\s*(.*)$/;

export function useCheckoutPrefill(setFormData: Setter): CheckoutPrefill {
  const [prefill, setPrefill] = useState<CheckoutPrefill>({
    applied: false,
    email: null,
    savedState: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    // ?only=saved — checkout wants one address, not forty orders.
    fetch('/api/account/orders?only=saved', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        const saved = result?.saved;
        if (!saved) return;

        const [, first = '', last = ''] = FIRST_WORD.exec(saved.fullName ?? '') ?? [];

        setFormData((previous) => ({
          ...previous,
          // Rule 1: anything the customer has already typed stays.
          firstName: previous.firstName || first,
          lastName: previous.lastName || last,
          email: previous.email || saved.email || '',
          phone: previous.phone || saved.phone || '',
          address: previous.address || saved.address || '',
          city: previous.city || saved.city || '',
        }));

        setPrefill({
          applied: true,
          email: saved.email ?? null,
          savedState: saved.state || null,
        });
      })
      .catch(() => {
        // Signed out, offline, or aborted. Checkout works exactly as it did
        // before this feature existed.
      });

    return () => controller.abort();
  }, [setFormData]);

  return prefill;
}
