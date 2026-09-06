/** STOREFRONT layer — the step-1 -> step-2 gate.
 *
 * Everything that has to be true before a customer is shown a bank account and
 * an amount to transfer: the address is present when the zone needs one, the
 * items are still in stock, and the server agrees on the price. Only when all
 * three hold does checkout advance, carrying the server-confirmed total. */
'use client';

import { toast } from 'sonner';
import type { ShippingZone } from '@/types/shipping';
import { CartItem } from '@/types/order';
import { useCheckoutStockValidation } from './useCheckoutStockValidation';
import { useCheckoutQuote, type AppliedCode } from './useCheckoutQuote';

interface UseCheckoutFormSubmitParams {
  items: CartItem[];
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  selectedZone?: ShippingZone;
  address: string;
  /** Checked against the blocklist before the payment screen, so a barred
   * buyer is refused before transferring rather than after. */
  customerEmail: string;
  /** Identifies this checkout attempt. */
  idempotencyKey: string;
  /** The code the customer typed, if any. */
  discountCode?: string;
  /** Receives the server-confirmed total and the server-issued order number for
   * the order about to be paid. */
  onReady: (confirmed: {
    total: number;
    orderNumber: string;
    /** What the server made of the code, so the summary can say so. */
    appliedCode: AppliedCode | null;
    codeError: string | null;
  }) => void;
}

export function useCheckoutFormSubmit({
  items,
  deliveryOption,
  selectedState,
  selectedLga,
  selectedPlace,
  selectedZone,
  address,
  customerEmail,
  idempotencyKey,
  discountCode,
  onReady,
}: UseCheckoutFormSubmitParams) {
  const { validateStock, isValidating } = useCheckoutStockValidation();
  const { fetchQuote, isQuoting } = useCheckoutQuote();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (deliveryOption === 'delivery' && selectedZone?.is_door_delivery && !address.trim()) {
      toast.error('Please enter your delivery address');
      return;
    }

    if (!(await validateStock(items))) return;

    // The server prices the cart itself. If anything has moved since these
    // items were added, this is where the cart is corrected and the customer
    // told — rather than after they have already transferred money.
    const quote = await fetchQuote({
      items, deliveryOption, selectedState, selectedLga, selectedPlace, idempotencyKey,
      customerEmail, discountCode,
    });
    if (!quote) return;

    // A refused code does not block checkout — the quote it came back with is
    // a valid price for the basket without it, and stopping here would strand
    // a customer over a typo they may not care about. useCheckoutQuote has
    // already told them why it did not apply.
    onReady({
      total: quote.total,
      orderNumber: quote.orderNumber,
      appliedCode: quote.applied_code,
      codeError: quote.code_error,
    });
  };

  return { handleSubmit, isSubmitting: isValidating || isQuoting };
}
