/**
 * STOREFRONT layer — everything one checkout needs, wired together.
 *
 * The composition of the eight hooks behind the three steps: where the attempt
 * is and what it holds (useCheckoutAttempt), what the customer typed
 * (useCheckoutForm), where it is going (useCheckoutShipping), what it costs,
 * how it gets paid for, and the two transitions between steps.
 *
 * Split from CheckoutFlow when persistence arrived and pushed that file past
 * the 200-line limit. The division is the one the rest of this folder already
 * uses: hooks hold the wiring, the component composes the markup.
 */
'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { calculateTax } from '@/lib/commerce/checkout';
import { applyFreeShipping } from '@/lib/commerce/store-settings';
import { useStoreSettings } from '@/components/StoreSettingsProvider';
import { useCheckoutAttempt } from './useCheckoutAttempt';
import { useCheckoutForm } from './useCheckoutForm';
import { useCheckoutIdentity } from './useCheckoutIdentity';
import { useCheckoutFormSubmit } from './useCheckoutFormSubmit';
import { useCheckoutPayment } from './useCheckoutPayment';
import type { AppliedCode } from './useCheckoutQuote';
import { useCheckoutShipping } from './useCheckoutShipping';
import { useCheckoutFieldErrors } from './useCheckoutFieldErrors';
import { useMobileOrderSummaryModal } from './useMobileOrderSummaryModal';

export function useCheckoutFlow() {
  const { items, getTotal, clearCart } = useCart();

  // Where this checkout is, what the server has issued for it, and how both
  // survive a refresh. See useCheckoutAttempt.
  const attempt = useCheckoutAttempt();
  const { step, setStep, restored, orderNumber, orderTotal, idempotencyKey } = attempt;

  // Signed in, straight through with everything prefilled. Signed out, offered
  // the choice — an offer, never a wall: see CheckoutSignInGate.
  const identity = useCheckoutIdentity();

  // capture stops once an order exists — nothing left to abandon, and the row
  // is marked recovered server-side anyway.
  const { formData, setFormData, prefill } = useCheckoutForm({
    items,
    capture: step === 'form',
    initial: restored?.formData,
  });
  const { fieldErrors, captureFieldErrors, clearFieldErrors } = useCheckoutFieldErrors();
  const shipping = useCheckoutShipping(restored);
  const { deliveryOption, selectedState, selectedLga, selectedPlace, selectedZone, shippingCost } =
    shipping;

  // The same two settings priceOrder() will apply on the server. This total is
  // a preview — the server recomputes it and the payment step switches to the
  // confirmed figure — but a preview that disagrees with the amount the
  // customer is then asked to transfer is worse than no preview.
  const { taxRate, freeShippingThreshold } = useStoreSettings();

  const subtotal = getTotal();
  const tax = calculateTax(subtotal, taxRate);
  const chargedShipping = applyFreeShipping(shippingCost, subtotal, freeShippingThreshold);
  const total = subtotal + tax + chargedShipping;

  /**
   * The draft is kept current for as long as an order is pending, rather than
   * written once at the transition: the customer can go back to the details,
   * change their address and come forward again, and what comes back after a
   * refresh has to be what they last saw.
   */
  const { persist } = attempt;
  useEffect(() => {
    persist({ formData, deliveryOption, selectedState, selectedLga, selectedPlace });
  }, [persist, formData, deliveryOption, selectedState, selectedLga, selectedPlace]);

  // The code box lives in the order summary, is sent with the quote at the
  // step-1 gate, and its verdict comes back on that same quote. Held here
  // because both the summary (which renders it) and the submit hook (which
  // sends it) are children of this one.
  const [discountCode, setDiscountCode] = useState('');
  const [appliedCode, setAppliedCode] = useState<AppliedCode | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const payment = useCheckoutPayment({
    // From the payment step onwards this is the server-confirmed total the
    // customer was actually asked to pay, not the locally-derived preview.
    total: orderTotal || total,
    orderNumber,
    idempotencyKey,
    items,
    formData,
    deliveryOption,
    selectedState,
    selectedLga,
    selectedPlace,
    onOrdered: () => {
      clearCart();
      attempt.completeOrder();
    },
    // Rejected fields live on the details step, so go back to it rather than
    // leaving the customer on a payment screen with nothing to fix.
    onValidationError: (body) => {
      const named = captureFieldErrors(body);
      if (named) setStep('form');
      return named;
    },
  });

  const { handleSubmit, isSubmitting } = useCheckoutFormSubmit({
    items,
    deliveryOption,
    selectedState,
    selectedLga,
    selectedPlace,
    selectedZone,
    address: formData.address,
    customerEmail: formData.email,
    idempotencyKey,
    // Both values come from the server: the total from priceOrder(), and the
    // order number from a Postgres sequence. Neither is invented here any more.
    discountCode,
    onReady: ({ total: confirmedTotal, orderNumber: issuedNumber, appliedCode: applied, codeError: error }) => {
      // Recorded before the step changes, so the summary on the payment screen
      // shows the same verdict the customer was just given.
      setAppliedCode(applied);
      setCodeError(error);
      attempt.beginPayment(issuedNumber, confirmedTotal);
    },
  });

  /** Drops last attempt's highlights, so a corrected form doesn't keep showing
   * errors the customer has already fixed. */
  const handleFormSubmit = (event: React.FormEvent) => {
    clearFieldErrors();
    handleSubmit(event);
  };

  const mobileOrderSummary = useMobileOrderSummaryModal();

  return {
    items,
    step,
    setStep,
    identity,
    orderNumber,
    orderTotal,
    formData,
    setFormData,
    prefill,
    fieldErrors,
    shipping,
    subtotal,
    tax,
    /** What delivery actually costs this basket: the zone's fee, waived if the
     *  subtotal has cleared the free-delivery threshold. Use this rather than
     *  `shipping.shippingCost`, which is the zone's fee before the offer. */
    shippingCost: chargedShipping,
    total,
    discountCode: {
      value: discountCode,
      onChange: (value: string) => {
        setDiscountCode(value);
        // The old verdict describes a code that is no longer typed.
        setAppliedCode(null);
        setCodeError(null);
      },
      applied: appliedCode,
      error: codeError,
    },
    payment,
    handleFormSubmit,
    isSubmitting,
    mobileOrderSummary,
  };
}
