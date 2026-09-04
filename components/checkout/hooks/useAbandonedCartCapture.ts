/**
 * STOREFRONT layer — recording the basket once there is an address to reach.
 *
 * Fires while somebody is filling in step one, debounced, and that debounce is
 * the whole design: without it this would post on every keystroke of an email
 * address, which is both a lot of requests and a stream of half-typed
 * addresses like "ada@gm".
 *
 * It sends only what a reminder needs — the address, the name and phone as
 * typed, and the basket as ids and quantities. No prices: the email is built
 * from the catalogue when it goes out, so it can never quote a figure the shop
 * has since changed.
 *
 * Failure is silence. This is bookkeeping for a marketing email; it must never
 * be visible to somebody trying to buy something.
 */
'use client';

import { useEffect, useRef } from 'react';
import type { CartItem } from '@/types/order';
import { isValidEmail } from '@/lib/validation';
import type { CheckoutFormData } from './useCheckoutForm';

/** Long enough that a typed address settles, short enough that somebody who
 *  wanders off mid-form has still been recorded. */
const DEBOUNCE_MS = 2500;

interface UseAbandonedCartCaptureArgs {
  formData: CheckoutFormData;
  items: CartItem[];
  /** False once an order exists — there is nothing left to abandon. */
  active: boolean;
}

export function useAbandonedCartCapture({ formData, items, active }: UseAbandonedCartCaptureArgs) {
  // What was last sent, so re-renders and unrelated field edits do not repost
  // an identical basket.
  const lastSent = useRef('');

  const email = formData.email.trim().toLowerCase();
  const name = `${formData.firstName} ${formData.lastName}`.trim();

  // Serialised, so the effect depends on the values rather than on array and
  // object identities that change every render.
  const basket = JSON.stringify(
    items.map((item) => ({
      product_id: item.productId,
      size: item.size ?? null,
      color: item.color ?? null,
      quantity: item.quantity,
    }))
  );

  useEffect(() => {
    if (!active || items.length === 0 || !isValidEmail(email)) return;

    const payload = JSON.stringify({ email, name, phone: formData.phone.trim(), items: JSON.parse(basket) });
    if (payload === lastSent.current) return;

    const timer = setTimeout(() => {
      lastSent.current = payload;

      // keepalive so the request survives the page being closed — which is
      // exactly the moment this feature exists for.
      fetch('/api/checkout/abandoned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [active, email, name, formData.phone, basket, items.length]);
}
