/** ADMIN layer — the returns on one order: their status, and moving one
 * through its lifecycle. Loaded on demand, like useOrderRefunds — most orders
 * have none, and the order detail fetch already carries items, change
 * requests and status history. */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Return, ReturnStatus } from '@/types/return';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

type ShowToast = (message: string, type?: 'success' | 'error') => void;

export type ReturnAction = 'approve' | 'reject' | 'receive' | 'inspect' | 'restock';

export function useOrderReturns(
  orderId: string,
  showToast: ShowToast,
  onChanged: () => Promise<void> | void
) {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch(`/api/orders/${orderId}/returns`);
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setError(result?.error || 'Could not load returns.');
        return;
      }

      setReturns(result.returns ?? []);
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

  /** Reconcile this panel and the order behind it. A restock changes stock and
   * a settled refund changes amount_refunded — either is stale on the order
   * summary until the parent re-reads too. */
  const reconcile = useCallback(async () => {
    await Promise.all([load(), onChanged()]);
  }, [load, onChanged]);

  const act = useCallback(
    async (
      returnId: string,
      action: ReturnAction,
      options?: { adminResponse?: string; refundAmount?: number }
    ): Promise<boolean> => {
      setSaving(true);
      try {
        const response = await adminFetch(`/api/orders/${orderId}/returns/${returnId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...options }),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          showToast(result?.error || 'Could not update this return.', 'error');
          return false;
        }

        await reconcile();
        const next = result.return?.status as ReturnStatus | undefined;
        showToast(next ? `Return marked ${next}.` : 'Return updated.', 'success');
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

  return { returns, loading, error, saving, act };
}
