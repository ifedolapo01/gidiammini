/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// Puts the basket back, then gets out of the way.
//
// The cart lives in localStorage, so only the browser can restore it. This
// runs once on mount and sends them to checkout — the link said "finish my
// order", and making them press another button to agree with themselves would
// be a step for its own sake.
//
// Merged rather than replaced: somebody may have added something new since the
// email went out, and silently deleting it would be worse than a basket with
// one extra thing in it. addToCart already tops up the quantity of a line that
// is already there.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';
import { useCart } from '@/components/CartProvider';

export interface RestoredLine {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size?: string;
  color?: string;
}

export function RestoreCart({ lines }: { lines: RestoredLine[] }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [done, setDone] = useState(false);
  // Once. The cart context changes identity as it fills, and without this
  // guard the effect would keep re-adding what it just added.
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    for (const line of lines) {
      addToCart({
        productId: line.productId,
        name: line.name,
        price: line.price,
        quantity: line.quantity,
        image: line.image,
        size: line.size,
        color: line.color,
      });
    }

    setDone(true);
    // replace, not push: the URL holds a single-use token and the back button
    // has no business returning to it.
    router.replace('/checkout');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-secondary px-4">
      <p className="flex items-center gap-3 text-body-md text-text-secondary">
        <Spinner size="md" />
        {done ? 'Taking you to checkout…' : 'Putting your basket back…'}
      </p>
    </div>
  );
}
