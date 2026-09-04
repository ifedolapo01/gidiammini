/**
 * STOREFRONT layer — the step-1 submit, in both places it appears.
 *
 * One component for the desktop button and the sticky mobile bar, which were
 * two copies of the same markup and had to grow the same new disabled state.
 *
 * That state is the point of it: the state select is `required` and holds no
 * value until the shipping zones arrive, so a tap before then was blocked by
 * the browser's own validation and did nothing at all — no spinner, no
 * message, a dead button. Now it says what it is waiting for.
 */
'use client';

import { Spinner } from '@/components/ui';

interface ProceedToPaymentButtonProps {
  /** The quote is running. */
  isSubmitting: boolean;
  /** Shipping zones have not arrived yet. */
  zonesLoading: boolean;
  /** They arrived, but there are none — nothing can be shipped anywhere. */
  noZones: boolean;
  variant: 'desktop' | 'mobile';
}

const DESKTOP =
  'hidden md:flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground py-3 md:py-4 rounded-control font-semibold text-body-md md:text-body-lg hover:bg-primary-hover transition-all duration-300 shadow-elevation-3 hover:shadow-elevation-4 disabled:opacity-60 disabled:pointer-events-none';

const MOBILE =
  'w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 sm:py-4 rounded-control font-semibold text-body-md sm:text-body-lg hover:bg-primary-hover disabled:opacity-60 disabled:pointer-events-none';

export default function ProceedToPaymentButton({
  isSubmitting,
  zonesLoading,
  noZones,
  variant,
}: ProceedToPaymentButtonProps) {
  const busy = isSubmitting || zonesLoading;
  const label = zonesLoading
    ? 'Loading delivery options…'
    : noZones
      ? 'Delivery unavailable'
      : isSubmitting
        ? 'Checking availability…'
        : 'Proceed to Payment';

  return (
    <button
      type="submit"
      // The mobile copy sits outside the <form>, in the sticky bar.
      form={variant === 'mobile' ? 'checkout-form' : undefined}
      disabled={busy || noZones}
      className={variant === 'desktop' ? DESKTOP : MOBILE}
    >
      {busy && <Spinner size="sm" />}
      {label}
    </button>
  );
}
