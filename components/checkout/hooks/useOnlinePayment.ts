/**
 * STOREFRONT layer — paying now, at the provider.
 *
 * The whole hook is: send the same order the receipt path sends, minus the
 * receipt, and follow the URL that comes back. Everything that decides what is
 * owed happens on the server, and the browser never learns anything it could
 * tamper with — no amount, no key, just a link.
 *
 * The cart is deliberately *not* cleared here. The customer is leaving for the
 * provider and may cancel, lose signal, or change their mind; the cart is
 * emptied on the way back, and only once the money is confirmed.
 */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { buildOrderPayload, reportOrderFailure, type OrderRequestArgs } from './order-request';
import { submitNewsletterOptIn } from './newsletter-opt-in';

interface UseOnlinePaymentArgs extends OrderRequestArgs {
  onValidationError?: (body: unknown) => boolean;
  /** Called when a replayed attempt turns out to be paid already, so the page
   *  can show the confirmation instead of charging twice. */
  onAlreadyPaid?: (orderNumber: string) => void;
}

export function useOnlinePayment(args: UseOnlinePaymentArgs) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  async function payNow() {
    setIsRedirecting(true);

    try {
      const response = await fetch('/api/checkout/paystack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildOrderPayload(args)),
      });

      const result = await response.json().catch(() => null);

      if (reportOrderFailure(response, result, { total: args.total, onValidationError: args.onValidationError })) {
        setIsRedirecting(false);
        return;
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'We could not start that payment. Please try again.');
      }

      if (result.alreadyPaid) {
        args.onAlreadyPaid?.(result.orderNumber);
        setIsRedirecting(false);
        return;
      }

      // Newsletter opt-in before leaving: there is no guarantee this tab is
      // ever seen again, and the customer ticked the box.
      await submitNewsletterOptIn(args.formData);

      // Leaves the site. The state stays "redirecting" on purpose — the button
      // must not look pressable while the browser is navigating away.
      window.location.href = result.authorizationUrl;
    } catch (error: any) {
      console.error('Online payment error:', error);
      toast.error(error?.message || 'We could not start that payment. Please try again.');
      setIsRedirecting(false);
    }
  }

  return { payNow, isRedirecting };
}
