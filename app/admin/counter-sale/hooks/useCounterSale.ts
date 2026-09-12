/** ADMIN layer — the draft of an in-progress counter sale, and submitting it.
 *
 * Sibling of useOrderEdit, not a variant of it: that hook edits an order that
 * already exists, this one builds a brand new one from nothing. Reuses the
 * same DraftLine shape and the same "preview the server will recompute"
 * philosophy for the running total.
 */
'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Order } from '@/types/order';
import { calculateTax } from '@/lib/commerce/checkout';
import { DEFAULT_STORE_SETTINGS } from '@/lib/commerce/store-settings';
import { useProductPicker } from '../../orders/hooks/useProductPicker';
import type { DraftLine } from '../../orders/hooks/useOrderEdit';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

export const COUNTER_SALE_PRODUCTS_ENDPOINT = '/api/admin/counter-sales/products';

export type PaymentMethod = 'cash' | 'pos';

let nextKey = 0;
const makeKey = () => `line-${++nextKey}`;

export function useCounterSale() {
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState<Order | null>(null);

  // The same cashier-safe endpoint AddOrderLine is told to use below, read
  // here too only for its tax rate — a cashier has no store:read, so this is
  // the one source that rate can come from for this screen's live preview.
  const { taxRate } = useProductPicker(COUNTER_SALE_PRODUCTS_ENDPOINT);

  const addLine = useCallback((line: Omit<DraftLine, 'key'>) => {
    setLines((current) => [...current, { ...line, key: makeKey() }]);
  }, []);

  const updateLine = useCallback((key: string, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  }, []);

  /** Labelled a preview everywhere it is shown, same as useOrderEdit's — the
   *  server recomputes it from these same lines in price-counter-sale.ts, and
   *  a browser figure presented as authoritative is one a cashier will one day
   *  quote at the till while the receipt says something else. */
  const preview = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const tax = calculateTax(subtotal, taxRate ?? DEFAULT_STORE_SETTINGS.taxRate);
    return { subtotal, tax, total: subtotal + tax };
  }, [lines, taxRate]);

  const reset = useCallback(() => {
    setLines([]);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setPaymentMethod('cash');
    setIdempotencyKey(crypto.randomUUID());
    setError('');
    setCompleted(null);
  }, []);

  const submit = useCallback(async () => {
    if (lines.length === 0) {
      setError('Add at least one item before taking payment.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await adminFetch('/api/admin/counter-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((line) => ({
            product_id: line.product_id,
            size: line.size,
            color: line.color,
            quantity: line.quantity,
          })),
          customer_name: customerName.trim() || undefined,
          customer_email: customerEmail.trim() || undefined,
          customer_phone: customerPhone.trim() || undefined,
          payment_method: paymentMethod,
          idempotency_key: idempotencyKey,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || 'Could not record this sale.');
        return;
      }

      setCompleted(result.order as Order);
    } catch {
      setError('Could not reach the server. Nothing was charged.');
    } finally {
      setSubmitting(false);
    }
  }, [lines, customerName, customerEmail, customerPhone, paymentMethod, idempotencyKey]);

  return {
    lines, addLine, updateLine, removeLine,
    customerName, setCustomerName,
    customerEmail, setCustomerEmail,
    customerPhone, setCustomerPhone,
    paymentMethod, setPaymentMethod,
    preview,
    submitting, error, submit,
    completed, reset,
  };
}
