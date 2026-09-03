/**
 * STOREFRONT layer — keeping the browser's wishlist and the account's in step.
 *
 * Extracted from WishlistProvider so the provider stays what it was: local
 * state over localStorage, working for a guest with no network at all. This
 * hook is the part that only matters once somebody signs in.
 *
 * How it decides whether anybody is signed in: it asks. The session cookie is
 * httpOnly by design, so there is nothing for JavaScript to read — instead the
 * sync POST answers 401 for a guest, which costs no database read (see
 * requireCustomer) and is the normal case. A 401 simply means "stay local".
 *
 * The merge is a union, never a replacement — see wishlist-sync.ts for why a
 * last-write-wins rule would silently delete things people had saved.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductCardProduct } from '@/types/product';

interface UseWishlistSyncArgs {
  /** What this browser holds, once localStorage has been read. */
  localItems: ProductCardProduct[];
  ready: boolean;
  /** Called with the merged list, as fresh product cards. */
  onMerged: (items: ProductCardProduct[]) => void;
}

export function useWishlistSync({ localItems, ready, onMerged }: UseWishlistSyncArgs) {
  const [signedIn, setSignedIn] = useState(false);
  // The sync runs once per page load. Without this guard it would re-run every
  // time the list changed — which is every time somebody hearts something.
  const synced = useRef(false);

  useEffect(() => {
    if (!ready || synced.current) return;
    synced.current = true;

    const controller = new AbortController();

    fetch('/api/account/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: localItems.map((item) => item.id) }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!result?.success) return;
        setSignedIn(true);
        onMerged((result.products ?? []) as ProductCardProduct[]);
      })
      .catch(() => {
        // Signed out, offline, or aborted. The wishlist works exactly as it did
        // before any of this existed.
      });

    return () => controller.abort();
    // localItems is read once, at the moment the sync fires; adding it to the
    // dependencies would re-run this on every heart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, onMerged]);

  /** Mirrors one change to the account. Silent: the local list has already
   *  updated, and a failed mirror must not undo what the customer just did —
   *  the next sync will union it back anyway. */
  const mirror = useCallback(
    (method: 'PUT' | 'DELETE', productId: string) => {
      if (!signedIn) return;

      fetch('/api/account/wishlist', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      }).catch(() => {});
    },
    [signedIn]
  );

  return { signedIn, mirror };
}
