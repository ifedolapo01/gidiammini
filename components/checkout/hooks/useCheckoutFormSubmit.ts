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
import { useCheckoutQuote } from './useCheckoutQuote';

interface UseCheckoutFormSubmitParams {
  items: CartItem[];
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  selectedZone?: ShippingZone;
  address: string;
  /** Identifies this checkout attempt. */
  idempotencyKey: string;
  /** Receives the server-confirmed total and the server-issued order number for
   * the order about to be paid. */
  onReady: (confirmed: { total: number; orderNumber: string }) => void;
}

export function useCheckoutFormSubmit({
  items,
  deliveryOption,
  selectedState,
  selectedLga,
  selectedPlace,
  selectedZone,
  address,
  idempotencyKey,
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
    });
    if (!quote) return;

    onReady({ total: quote.total, orderNumber: quote.orderNumber });
  };

  return { handleSubmit, isSubmitting: isValidating || isQuoting };
}
