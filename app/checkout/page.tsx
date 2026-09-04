/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/checkout/page.tsx
//
// A boundary and nothing else. The flow reads its step from `?step=`, and
// useSearchParams in a statically rendered route has to sit inside Suspense —
// without one, Next opts the whole page out of prerendering.
'use client';

import { Suspense } from 'react';
import CheckoutFlow from '@/components/checkout/CheckoutFlow';
import { Spinner } from '@/components/ui';

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner size="lg" className="text-primary" label="Loading checkout" />
        </div>
      }
    >
      <CheckoutFlow />
    </Suspense>
  );
}
