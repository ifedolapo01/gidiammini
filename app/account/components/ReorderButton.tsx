/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// "Buy it again".
//
// The server decides what the lines are — which variant, at today's price,
// clamped to what is in stock — and this adds them to the cart, which lives in
// the browser. So the button is one request and then local state, and the
// answer it gives is honest about what could not come back: a sold-out size or
// a delisted product is named in the toast rather than silently dropped.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui';
import { useCart } from '@/components/CartProvider';
import type { CartItem } from '@/types/order';

interface ReorderButtonProps {
  orderId: string;
  orderNumber: string;
}

export function ReorderButton({ orderId, orderNumber }: ReorderButtonProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [working, setWorking] = useState(false);

  async function reorder() {
    setWorking(true);

    try {
      const response = await fetch('/api/account/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        toast.error(result?.error || 'We could not rebuild that order. Please try again.');
        return;
      }

      const lines = (result.lines ?? []) as CartItem[];
      for (const line of lines) addToCart(line);

      if (lines.length === 0) {
        // Nothing to add is a real answer, not a failure — say it and stay put.
        toast.error(result.message);
        return;
      }

      if (result.priceChanged) {
        toast.info('Some prices have changed since that order — the cart shows the current ones.');
      }
      toast.success(result.message);
      router.push('/cart');
    } catch {
      toast.error('We could not reach the server. Please check your connection.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <Button variant="outline" size="sm" loading={working} onClick={reorder}>
      <RotateCcw className="h-4 w-4" aria-hidden="true" />
      <span>
        Buy it again<span className="sr-only"> — everything from order {orderNumber}</span>
      </span>
    </Button>
  );
}
