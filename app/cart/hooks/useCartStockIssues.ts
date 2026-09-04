/** STOREFRONT layer — flags unbuyable cart lines before checkout step one. */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCartStockCheck } from '@/components/commerce/hooks/useCartStockCheck';
import { cartLineKey } from '@/lib/commerce/cart-input';
import { findCartStockIssues, type CartStockIssue } from '@/lib/commerce/cart-stock';
import type { CartItem } from '@/types/order';

/**
 * Stock problems in the cart, keyed by `cartLineKey`, so a sold-out item is
 * flagged on the cart page rather than at the checkout gate — by which point
 * the customer has already filled in an address.
 *
 * Stock is read once per line, not on every edit: the snapshot is kept and
 * issues re-derived locally, so raising a quantity past what is left is caught
 * without another round trip. Lines added later (or restored from another tab)
 * are read when they appear. A failed read flags nothing — the checkout gate
 * is still the authority, and the server refuses the order after that.
 */
export function useCartStockIssues(items: CartItem[]): Map<string, CartStockIssue> {
  const { fetchStock } = useCartStockCheck();
  const [snapshot, setSnapshot] = useState<Map<string, number>>(() => new Map());
  // Keys already read, or read and failed. Prevents a failed read from
  // retrying on every render.
  const attempted = useRef(new Set<string>());

  const unread = items.filter(
    (item) => !attempted.current.has(cartLineKey(item.productId, item.size, item.color))
  );
  const unreadKeys = unread
    .map((item) => cartLineKey(item.productId, item.size, item.color))
    .join(',');

  useEffect(() => {
    if (!unreadKeys) return;

    let cancelled = false;
    const lines = unread;
    // Marked before the await, so a re-render mid-flight does not queue the
    // same read again.
    for (const key of unreadKeys.split(',')) attempted.current.add(key);

    fetchStock(lines).then((fresh) => {
      if (cancelled || !fresh) return;
      setSnapshot((previous) => new Map([...previous, ...fresh]));
    });

    return () => {
      cancelled = true;
    };
    // `unread`/`fetchStock` are derived fresh each render; unreadKeys is the
    // value that actually decides whether there is anything to read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadKeys]);

  return useMemo(
    () => new Map(findCartStockIssues(items, snapshot).map((issue) => [issue.key, issue])),
    [items, snapshot]
  );
}
