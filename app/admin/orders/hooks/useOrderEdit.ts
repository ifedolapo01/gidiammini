/** ADMIN layer — the draft of an edited order, and saving it.
 *
 * The panel edits a copy. Nothing is sent until Save, because a line-at-a-time
 * endpoint would mean three round trips to swap a colour and would let an
 * operator leave an order half-edited by closing the tab — and each of those
 * trips would move stock and email the customer.
 *
 * So the whole set of lines goes in one request, the server recomputes the
 * total from them, and the response is the truth the panel re-renders from.
 * The draft never computes a total it would then have to agree with.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Order, OrderItem } from '@/types/order';
import { TAX_RATE } from '@/lib/commerce/checkout';

type ShowToast = (message: string, type?: 'success' | 'error') => void;

/** A line being edited. `key` is local only — it keeps React rows stable while
 * the product, size or colour underneath them is still being chosen. */
export interface DraftLine {
  key: string;
  product_id: string | null;
  product_name: string;
  price: number;
  quantity: number;
  size: string | null;
  color: string | null;
}

let nextKey = 0;
const makeKey = () => `line-${++nextKey}`;

function toDraft(items: OrderItem[]): DraftLine[] {
  return items.map((item) => ({
    key: makeKey(),
    product_id: item.product_id ?? null,
    product_name: item.product_name,
    price: item.price,
    quantity: item.quantity,
    size: item.size ?? null,
    color: item.color ?? null,
  }));
}

export function useOrderEdit(order: Order, showToast: ShowToast, onSaved: () => Promise<void> | void) {
  const [lines, setLines] = useState<DraftLine[]>(() => toDraft(order.order_items ?? []));
  const [discount, setDiscount] = useState<number>(order.discount_amount ?? 0);
  const [discountReason, setDiscountReason] = useState(order.discount_reason ?? '');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  // Re-seed when the panel is pointed at a different order, or when a save has
  // been reconciled from the server. Keyed on the order id and its updated_at
  // so an unrelated re-render does not throw away work in progress.
  const seed = `${order.id}:${order.updated_at}`;
  useEffect(() => {
    setLines(toDraft(order.order_items ?? []));
    setDiscount(order.discount_amount ?? 0);
    setDiscountReason(order.discount_reason ?? '');
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  /**
   * The preview total.
   *
   * Deliberately labelled a preview everywhere it is shown. The server is the
   * authority — edit_order_items() recomputes from the same lines — and this
   * mirrors its arithmetic only so the operator is not typing blind. Shipping
   * is carried through untouched, exactly as the function does.
   */
  const preview = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const tax = Math.round(subtotal * TAX_RATE);
    const shipping = order.shipping_amount ?? 0;
    return {
      subtotal,
      tax,
      shipping,
      discount,
      total: subtotal + tax + shipping - discount,
    };
  }, [lines, discount, order.shipping_amount]);

  const dirty = useMemo(() => {
    const before = toDraft(order.order_items ?? []);
    const same =
      before.length === lines.length &&
      before.every((line, index) => {
        const now = lines[index];
        return (
          now &&
          line.product_id === now.product_id &&
          line.product_name === now.product_name &&
          line.price === now.price &&
          line.quantity === now.quantity &&
          line.size === now.size &&
          line.color === now.color
        );
      });

    return !same
      || discount !== (order.discount_amount ?? 0)
      || discountReason !== (order.discount_reason ?? '');
  }, [lines, discount, discountReason, order]);

  const addLine = useCallback((line: Omit<DraftLine, 'key'>) => {
    setLines((current) => [...current, { ...line, key: makeKey() }]);
  }, []);

  const updateLine = useCallback((key: string, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  }, []);

  const save = useCallback(async () => {
    if (lines.length === 0) {
      showToast('An order must keep at least one item. Cancel it instead of emptying it.', 'error');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map(({ key: _key, ...line }) => line),
          discount_amount: discount,
          discount_reason: discountReason.trim() || null,
          note: note.trim() || null,
          notify,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        showToast(result?.error || 'Could not save this edit.', 'error');
        return;
      }

      await onSaved();
      showToast(
        notify && result.notified
          ? `${result.message} The customer has been emailed.`
          : notify
            ? `${result.message} The customer could not be emailed — tell them yourself.`
            : result.message,
        notify && !result.notified ? 'error' : 'success'
      );
    } catch {
      showToast('Could not reach the server. Nothing was changed.', 'error');
    } finally {
      setSaving(false);
    }
  }, [lines, discount, discountReason, note, notify, order.id, showToast, onSaved]);

  return {
    lines, addLine, updateLine, removeLine,
    discount, setDiscount,
    discountReason, setDiscountReason,
    note, setNote,
    notify, setNotify,
    preview, dirty, saving, save,
    reset: useCallback(() => {
      setLines(toDraft(order.order_items ?? []));
      setDiscount(order.discount_amount ?? 0);
      setDiscountReason(order.discount_reason ?? '');
      setNote('');
    }, [order]),
  };
}
