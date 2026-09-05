/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/RefundPanel.tsx
//
// The refunds tab: what has gone back, and the form for sending more.
//
// Composition only — the list, the form and the loading state each own
// themselves, and this decides what to show. The one piece of judgement here
// is the order: the form sits below the history, because the first question
// somebody opening this tab has is "has this already been refunded", and
// leading with an empty amount field invites answering it twice.
'use client';

import { Spinner } from '@/components/ui';
import { useOrderRefunds } from '../hooks/useOrderRefunds';
import RefundForm from './RefundForm';
import RefundList from './RefundList';

interface RefundPanelProps {
  orderId: string;
  showToast: (message: string, type?: 'success' | 'error') => void;
  /** Re-read the order behind this panel: a refund moves amount_refunded, so
   * the money summary above is stale until the parent refetches. */
  onChanged: () => Promise<void> | void;
}

export default function RefundPanel({ orderId, showToast, onChanged }: RefundPanelProps) {
  const { refunds, totals, loading, error, saving, create, settle } = useOrderRefunds(
    orderId,
    showToast,
    onChanged
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-secondary">
        <Spinner size="sm" />
        <span className="text-body-sm">Loading refunds…</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-surface border border-destructive-border bg-destructive-background p-3 text-body-sm text-destructive">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 font-semibold text-text-primary">Refunds so far</h3>
        <RefundList refunds={refunds} saving={saving} onSettle={settle} />
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-text-primary">Issue a refund</h3>

        {/* Whether a refund is possible at all is a fact about the order, not
            about the form, so it is answered here rather than by a form that
            renders itself as an explanation. */}
        {totals.refundable > 0 ? (
          <RefundForm totals={totals} saving={saving} onSubmit={create} />
        ) : (
          <p className="rounded-surface border border-border bg-background-secondary p-3 text-body-sm text-text-secondary">
            {totals.amount_paid <= 0
              ? 'Nothing has been received on this order, so there is nothing to refund.'
              : 'Everything received on this order has already been refunded.'}
          </p>
        )}
      </div>
    </div>
  );
}
