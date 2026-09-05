/** ADMIN layer — the refunds on one order: what has gone back, and issuing more.
 *
 * Loaded on demand rather than embedded on the order, because most orders have
 * no refunds and the detail fetch already carries items, change requests and
 * status history.
 *
 * The ceiling on a new refund — what arrived, less what has already gone back
 * — is read from the server rather than computed here. It is the one figure
 * that must not be a browser's opinion: an order paid in two instalments and
 * partly refunded already has three numbers behind it, and getting the sum
 * wrong means paying out money that never came in.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrderRefund, OrderRefundTotals } from '@/types/order';

type ShowToast = (message: string, type?: 'success' | 'error') => void;

const EMPTY_TOTALS: OrderRefundTotals = {
  total_amount: 0,
  amount_paid: 0,
  amount_refunded: 0,
  refundable: 0,
};

export interface NewRefund {
  amount: number;
  method: string;
  reason_code: string;
  reference?: string;
  note?: string;
  settled: boolean;
  notify: boolean;
}

export function useOrderRefunds(
  orderId: string,
  showToast: ShowToast,
  onChanged: () => Promise<void> | void
) {
  const [refunds, setRefunds] = useState<OrderRefund[]>([]);
  const [totals, setTotals] = useState<OrderRefundTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/refunds`);
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || 'Could not load refunds.');
        return;
      }

      setRefunds(result.refunds ?? []);
      setTotals(result.totals ?? EMPTY_TOTALS);
      setError('');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Reconcile this panel and the order behind it. A refund changes
   * orders.amount_refunded, so the money summary above is stale until the
   * parent re-reads too. */
  const reconcile = useCallback(async () => {
    await Promise.all([load(), onChanged()]);
  }, [load, onChanged]);

  const create = useCallback(
    async (input: NewRefund): Promise<boolean> => {
      setSaving(true);
      try {
        const response = await fetch(`/api/orders/${orderId}/refunds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          showToast(result?.error || 'Could not record this refund.', 'error');
          return false;
        }

        await reconcile();
        showToast(result.message, 'success');
        return true;
      } catch {
        showToast('Could not reach the server. Nothing was changed.', 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orderId, showToast, reconcile]
  );

  const settle = useCallback(
    async (refundId: string, outcome: 'completed' | 'failed', reference?: string): Promise<boolean> => {
      setSaving(true);
      try {
        const response = await fetch(`/api/orders/${orderId}/refunds/${refundId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome, reference: reference || null }),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          showToast(result?.error || 'Could not update this refund.', 'error');
          return false;
        }

        await reconcile();
        showToast(result.message, 'success');
        return true;
      } catch {
        showToast('Could not reach the server. Nothing was changed.', 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orderId, showToast, reconcile]
  );

  return { refunds, totals, loading, error, saving, create, settle, reload: load };
}
