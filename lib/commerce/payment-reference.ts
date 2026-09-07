/** COMMERCE layer — the reference a payment is matched back to an order by.
 *
 * "<order number>-<random>", the shape app/api/checkout/paystack/route.ts
 * originally minted for itself. Factored out so every order gets one at
 * creation regardless of payment method — a transfer's narration and a
 * Paystack transaction reference then both live in the same column and are
 * searchable the same way (see the payments queue's reference search).
 * Paystack's own flow overwrites this with the gateway-confirmed reference
 * once the provider responds; nothing else about that flow changes.
 */
import { randomBytes } from 'node:crypto';

export function generatePaymentReference(orderNumber: string): string {
  return `${orderNumber}-${randomBytes(4).toString('hex')}`;
}
