/**
 * STOREFRONT layer — keeping the browser's cart and the account's in step.
 *
 * Mirrors useWishlistSync's shape (ask once per page load whether anybody's
 * signed in — the session cookie is httpOnly, so there is nothing for
 * JavaScript to read directly, see customer-session.ts) plus
 * useAbandonedCartCapture's debounce technique for pushing subsequent edits.
 *
 * One difference from wishlist worth naming: wishlist mutations are single-
 * item toggles from a heart button, mirrored to the server immediately and
 * individually. A cart edit is a quantity change on a page that already holds
 * the whole cart object, and is going to be followed by more edits in quick
 * succession — so instead of a per-mutation call, this hook just watches
 * `items` and debounce-pushes the whole array. CartProvider's addToCart /
 * removeFromCart / updateQuantity need no changes at all.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import type { CartItem } from '@/types/order';

/** Same window as useAbandonedCartCapture: long enough that a burst of
 *  quantity clicks settles, short enough that closing the tab soon after
 *  still has a chance to have already sent. */
const DEBOUNCE_MS = 2500;

interface UseCartSyncArgs {
  items: CartItem[];
  ready: boolean;
  /** Called with the merged, server-priced cart. Replaces local state
   *  wholesale, same as WishlistProvider's onMerged. */
  onMerged: (items: CartItem[]) => void;
}

function toLines(items: CartItem[]) {
  return items.map((item) => ({
    product_id: item.productId,
    size: item.size ?? null,
    color: item.color ?? null,
    quantity: item.quantity,
  }));
}

export function useCartSync({ items, ready, onMerged }: UseCartSyncArgs) {
  const [signedIn, setSignedIn] = useState(false);
  // The sync runs once per page load. Without this guard it would re-run
  // every time the cart changed — which is every time a quantity is edited.
  const synced = useRef(false);
  const lastSent = useRef('');

  useEffect(() => {
    if (!ready || synced.current) return;
    synced.current = true;

    const controller = new AbortController();

    fetch('/api/account/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: toLines(items) }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!result?.success) return;
        // `signedIn: false` is the guest answer — a 200 with the cart
        // unchanged, so adopting it would wipe the browser's own cart.
        if (!result.signedIn) return;
        setSignedIn(true);
        onMerged((result.items ?? []) as CartItem[]);
      })
      .catch(() => {
        // Signed out, offline, or aborted. The cart works exactly as it did
        // before any of this existed.
      });

    return () => controller.abort();
    // items is read once, at the moment the sync fires; adding it to the
    // dependencies would re-run this on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, onMerged]);

  // Serialised, so the effect depends on the values rather than on the array
  // identity, which changes every render.
  const payload = JSON.stringify({ lines: toLines(items) });

  useEffect(() => {
    if (!signedIn || items.length === 0) return;
    if (payload === lastSent.current) return;

    const timer = setTimeout(() => {
      lastSent.current = payload;

      // keepalive so an edit made just before closing the tab still has a
      // chance to reach the server.
      fetch('/api/account/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [signedIn, payload, items.length]);

  return { signedIn };
}
