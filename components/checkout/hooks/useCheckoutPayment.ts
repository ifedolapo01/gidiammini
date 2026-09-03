/**
 * STOREFRONT layer — how this checkout gets paid for.
 *
 * One hook over the two paths, because from the page's point of view they are
 * one concern with one selector: upload a receipt for a transfer you made
 * yourself, or pay at the provider and come back confirmed. Both submit the
 * same order (see order-request.ts); they differ in what happens after.
 *
 * Extracted from the checkout page when the second path arrived — wiring two
 * submission hooks plus a selector inline had pushed that file past 200 lines,
 * and none of it was about rendering a checkout.
 */
'use client';

import { useState } from 'react';
import { CartItem } from '@/types/order';
import type { CheckoutFormData } from './useCheckoutForm';
import { useOrderSubmission } from './useOrderSubmission';
import { useOnlinePayment } from './useOnlinePayment';
import type { PaymentMethod } from '../PaymentMethodChoice';

interface UseCheckoutPaymentArgs {
  orderNumber: string;
  idempotencyKey: string;
  /** The server-confirmed total once the quote has run, else the local preview. */
  total: number;
  items: CartItem[];
  formData: CheckoutFormData;
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  /** Order placed (receipt sent, or a replay that was already paid). */
  onOrdered: () => void;
  onValidationError: (body: unknown) => boolean;
}

/** Everything the payment step needs, handed over as one object rather than
 *  ten props — they are one thing, and the step should not have to be rewired
 *  every time this hook grows a field. */
export type CheckoutPayment = ReturnType<typeof useCheckoutPayment>;

export function useCheckoutPayment(args: UseCheckoutPaymentArgs) {
  /**
   * Online first, because it is the path that ends the wait — but the choice
   * is the customer's, and it lives here rather than in the payment step so it
   * survives a trip back to the details and forward again.
   *
   * The provider's secret is server-side; this flag only decides whether the
   * option is offered. The route checks the real key independently, so a wrong
   * flag produces a clean "not available", never a broken charge.
   */
  const onlineAvailable = process.env.NEXT_PUBLIC_PAYSTACK_ENABLED === 'true';
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    onlineAvailable ? 'online' : 'transfer'
  );

  const receipt = useOrderSubmission({
    total: args.total,
    orderNumber: args.orderNumber,
    idempotencyKey: args.idempotencyKey,
    items: args.items,
    formData: args.formData,
    deliveryOption: args.deliveryOption,
    selectedState: args.selectedState,
    selectedLga: args.selectedLga,
    selectedPlace: args.selectedPlace,
    onSuccess: args.onOrdered,
    onValidationError: args.onValidationError,
  });

  const online = useOnlinePayment({
    idempotencyKey: args.idempotencyKey,
    total: args.total,
    items: args.items,
    formData: args.formData,
    deliveryOption: args.deliveryOption,
    selectedState: args.selectedState,
    selectedLga: args.selectedLga,
    selectedPlace: args.selectedPlace,
    onValidationError: args.onValidationError,
    // A replayed key on an order that is already paid: show the confirmation
    // rather than sending them to pay twice.
    onAlreadyPaid: args.onOrdered,
  });

  return {
    ...receipt,
    paymentMethod,
    setPaymentMethod,
    onlineAvailable,
    isRedirecting: online.isRedirecting,
    handlePayOnline: online.payNow,
  };
}
