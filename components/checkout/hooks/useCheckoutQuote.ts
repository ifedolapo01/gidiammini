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

export interface AppliedCode {
  code: string;
  discount_id: string;
  saved_on_items: number;
  saved_on_shipping: number;
}

export interface CheckoutQuote {
  items: PricedCartLine[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  /** Server-issued, and stable for this checkout attempt. */
  orderNumber: string;
  /** The code the server accepted, and what it was worth. Null when none was
   *  sent or it was refused. */
  applied_code: AppliedCode | null;
  /** Why a code was refused, in the customer's words. The quote itself is
   *  still valid — a bad code must not cost somebody their total. */
  code_error: string | null;
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
  /** Sent so the server can refuse a barred buyer before the payment screen,
   * rather than after they have transferred. Never used for pricing. */
  customerEmail: string;
  /** What the customer typed in the code box. Validated server-side against
   *  the live discount row; nothing about it is trusted here. */
  discountCode?: string;
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
          customer_email: request.customerEmail,
          delivery_option: request.deliveryOption,
          selected_state: request.selectedState,
          selected_lga: request.selectedLga || null,
          selected_place: request.selectedPlace || null,
          discount_code: request.discountCode?.trim() || null,
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

      // A refused code is surfaced here rather than left to the caller: every
      // caller would have to remember, and a code that silently does nothing
      // is the single most common complaint about checkout discount fields.
      if (quote.code_error) {
        toast.error(quote.code_error, { duration: 8000 });
      } else if (quote.applied_code) {
        const saved = quote.applied_code.saved_on_items + quote.applied_code.saved_on_shipping;
        toast.success(
          saved > 0
            ? `${quote.applied_code.code} applied — you saved ${formatCurrency(saved)}.`
            : // A code that lost to a better sale on every line. Saying
              // "applied" and showing no change is worse than explaining.
              `${quote.applied_code.code} is valid, but the prices you already have are better.`,
          { duration: 8000 }
        );
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
