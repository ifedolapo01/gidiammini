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

import { useEffect } from 'react';
import { useCart } from '@/components/CartProvider';
import { calculateTax } from '@/lib/commerce/checkout';
import { useCheckoutAttempt } from './useCheckoutAttempt';
import { useCheckoutForm } from './useCheckoutForm';
import { useCheckoutIdentity } from './useCheckoutIdentity';
import { useCheckoutFormSubmit } from './useCheckoutFormSubmit';
import { useCheckoutPayment } from './useCheckoutPayment';
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

  const subtotal = getTotal();
  const tax = calculateTax(subtotal);
  const total = subtotal + tax + shippingCost;

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
    onReady: ({ total: confirmedTotal, orderNumber: issuedNumber }) => {
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
    total,
    payment,
    handleFormSubmit,
    isSubmitting,
    mobileOrderSummary,
  };
}
