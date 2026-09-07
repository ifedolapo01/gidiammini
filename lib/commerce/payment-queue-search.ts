/** COMMERCE layer (pure) — finding one order in an already-loaded payment
 * queue by whatever an admin has in hand: a name, a phone number, or a whole
 * bank alert pasted in one go. The queue is already fetched in full for the
 * screen it renders on, so this is a client-side filter rather than a new
 * endpoint — see app/admin/payments/components/QueueList.tsx.
 */
import { ORDER_NUMBER_TOKEN } from './order-number';
import type { PaymentQueueItem } from '@/types/payment';

/** Pulls an order-number-shaped token out of a longer string, if one is
 *  there — the thing worth extracting from a pasted bank SMS. */
export function extractOrderNumber(text: string): string | null {
  const match = text.toUpperCase().match(ORDER_NUMBER_TOKEN);
  return match ? match[0] : null;
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

/** True when `query` (a name, a phone, a reference, or a pasted alert
 *  containing any of those) plausibly refers to this order. */
export function matchesPaymentQueueSearch(item: PaymentQueueItem, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const orderNumberToken = extractOrderNumber(trimmed);
  if (orderNumberToken && item.order_number.toUpperCase() === orderNumberToken) return true;

  const needle = normalise(trimmed);
  return (
    normalise(item.order_number).includes(needle) ||
    normalise(item.customer_name).includes(needle) ||
    item.customer_phone.includes(trimmed) ||
    (item.payment_reference != null && normalise(item.payment_reference).includes(needle))
  );
}

/** Filters the queue by `query`. Empty query returns every item unchanged. */
export function filterPaymentQueue(items: PaymentQueueItem[], query: string): PaymentQueueItem[] {
  if (!query.trim()) return items;
  return items.filter((item) => matchesPaymentQueueSearch(item, query));
}
