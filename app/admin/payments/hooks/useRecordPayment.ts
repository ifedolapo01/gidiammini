/**
 * ADMIN layer — submitting one verification decision.
 *
 * Separate from usePaymentQueue because the two fail differently. A queue that
 * cannot load shows an error page; a decision that is refused has to keep the
 * form, the amount already typed and the receipt on screen, because the
 * refusal is usually "that leaves a balance — record it as short paid" and the
 * fix is one tap away.
 *
 * The whole admin's orders surfaces listen for notifyOrdersChanged, so a
 * confirmed payment updates the alerts and the orders list without either of
 * them polling for it.
 */
'use client';

import { useCallback, useState } from 'react';
import type { RecordPaymentInput } from '@/types/payment';
import { notifyOrdersChanged } from '../../lib/orderEvents';
import { useToast } from '../../hooks/useToast';

interface UseRecordPaymentOptions {
  /** Run after a decision lands — moves the queue on. */
  onRecorded: () => void | Promise<void>;
}

export function useRecordPayment({ onRecorded }: UseRecordPaymentOptions) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const record = useCallback(
    async (input: RecordPaymentInput): Promise<boolean> => {
      setSaving(true);
      setError(null);

      try {
        const response = await fetch('/api/admin/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          const message = result?.error || 'Could not record this payment.';
          setError(message);
          return false;
        }

        showToast(describeOutcome(input.status, result), result.warning ? 'error' : 'success');

        // The queue, the orders list and the worklist counts all move on this.
        notifyOrdersChanged();
        await onRecorded();
        return true;
      } catch {
        setError('Could not reach the server. Nothing was recorded.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [onRecorded, showToast]
  );

  return { record, saving, error, clearError: () => setError(null) };
}

/** What actually happened, in the operator's terms rather than the API's. */
function describeOutcome(status: RecordPaymentInput['status'], result: any): string {
  if (result.warning) return result.warning;

  if (status === 'rejected') return 'Receipt rejected — the customer has been emailed what to do next.';
  if (result.confirmed) return 'Payment verified and the order is confirmed.';
  if (result.outstanding > 0) return 'Part payment recorded — the customer has been emailed the balance.';

  return 'Payment recorded.';
}
