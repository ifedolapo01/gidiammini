/** STOREFRONT layer — fetches the server's authoritative price for the cart
 * before the customer is shown an amount to transfer.
 *
 * The checkout page computes a total locally for display, but that number is
 * only ever a preview: prices, discounts and delivery fees can all change
 * between adding to cart and paying. This hook asks the server what the order
 * actually costs, corrects the cart when they disagree, and hands back the
 * total the customer should transfer. */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useCart, type PricedCartLine } from '@/components/CartProvider';
import { CartItem } from '@/types/order';
import { formatCurrency } from '@/lib/commerce/pricing';

export interface CheckoutQuote {
  items: PricedCartLine[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  /** Server-issued, and stable for this checkout attempt. */
  orderNumber: string;
}

interface QuoteRequest {
  items: CartItem[];
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  /** Identifies this checkout attempt, so the order number and the eventual
   * order are both tied to it. */
  idempotencyKey: string;
}

export function useCheckoutQuote() {
  const { syncPrices } = useCart();
  const [isQuoting, setIsQuoting] = useState(false);

  /**
   * Returns the server-priced quote, or null when the order can't be priced
   * (out of stock, unserviceable location, network failure) — in which case the
   * customer has already been told why and checkout should not advance.
   */
  const fetchQuote = async (request: QuoteRequest): Promise<CheckoutQuote | null> => {
    setIsQuoting(true);

    try {
      const response = await fetch('/api/checkout/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: request.idempotencyKey,
          delivery_option: request.deliveryOption,
          selected_state: request.selectedState,
          selected_lga: request.selectedLga || null,
          selected_place: request.selectedPlace || null,
          items: request.items.map((item) => ({
            product_id: item.productId,
            size: item.size ?? null,
            color: item.color ?? null,
            quantity: item.quantity,
          })),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        toast.error(result?.error || 'We could not price your order. Please try again.');
        return null;
      }

      const quote: CheckoutQuote = { ...result.quote, orderNumber: result.order_number };

      if (syncPrices(quote.items)) {
        toast.info(`Prices have changed since you added these items. Your new total is ${formatCurrency(quote.total)}.`, {
          duration: 8000,
        });
      }

      return quote;
    } catch (error) {
      console.error('Error fetching checkout quote:', error);
      toast.error('We could not reach the server to confirm your total. Please check your connection.');
      return null;
    } finally {
      setIsQuoting(false);
    }
  };

  return { fetchQuote, isQuoting };
}
