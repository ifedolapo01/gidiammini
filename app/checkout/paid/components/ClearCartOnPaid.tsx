/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// Empties the cart once a payment is confirmed.
//
// The cart lives in the browser, so the server cannot clear it — and the
// customer has come back from the provider on a fresh navigation, which means
// the checkout page's own success handler never ran.
//
// Rendered only on the confirmed branch: a cancelled payment must leave the
// cart exactly as it was, or there is nothing to retry with.
'use client';

import { useEffect } from 'react';
import { useCart } from '@/components/CartProvider';

export function ClearCartOnPaid() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
    // Once, on mount. clearCart is recreated each render, so depending on it
    // would clear the cart forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
