/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/RefundList.tsx
//
// Every refund on this order, newest first, with the two buttons a pending one
// needs: it went out, or it did not.
//
// A pending refund is the row that matters. It is money the shop has promised
// and not yet sent, and leaving it invisible is how a customer ends up waiting
// on a transfer nobody remembers agreeing to — so it is the only row that
// carries an action.
'use client';

import { useState } from 'react';
import { Badge, Button, Input } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';
import { refundLabel, REFUND_METHOD_LABELS, type RefundMethod } from '@/lib/commerce/refund-reasons';
import type { OrderRefund } from '@/types/order';

interface RefundListProps {
  refunds: OrderRefund[];
  saving: boolean;
  onSettle: (refundId: string, outcome: 'completed' | 'failed', reference?: string) => Promise<boolean>;
}

const TONES = {
  pending: 'warning',
  completed: 'success',
  failed: 'destructive',
} as const;

const LABELS = {
  pending: 'Agreed, not sent',
  completed: 'Sent',
  failed: 'Failed',
} as const;

function PendingActions({
  refund,
  saving,
  onSettle,
}: {
  refund: OrderRefund;
  saving: boolean;
  onSettle: RefundListProps['onSettle'];
}) {
  const [reference, setReference] = useState(refund.reference ?? '');

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <label
        htmlFor={`settle-reference-${refund.id}`}
        className="block text-caption-md text-text-secondary"
      >
        Transfer reference (optional)
      </label>
      <Input
        id={`settle-reference-${refund.id}`}
        size="sm"
        value={reference}
        onChange={(event) => setReference(event.target.value)}
        placeholder="What the customer will look for"
        autoComplete="off"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="success"
          disabled={saving}
          onClick={() => onSettle(refund.id, 'completed', reference.trim() || undefined)}
        >
          It has gone out
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => onSettle(refund.id, 'failed')}
        >
          The transfer failed
        </Button>
      </div>
    </div>
  );
}

export default function RefundList({ refunds, saving, onSettle }: RefundListProps) {
  if (refunds.length === 0) {
    return <p className="text-body-sm text-text-secondary">No refunds on this order.</p>;
  }

  return (
    <ul className="space-y-2">
      {refunds.map((refund) => (
        <li key={refund.id} className="rounded-surface bg-background-secondary p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-body-md font-semibold text-text-primary">
              {formatCurrency(Number(refund.amount))}
            </span>
            <Badge tone={TONES[refund.status]}>{LABELS[refund.status]}</Badge>
          </div>

          <p className="mt-1 text-body-sm text-text-secondary">
            {refundLabel(refund.reason_code)}
            {' · '}
            {REFUND_METHOD_LABELS[refund.method as RefundMethod] ?? refund.method}
          </p>

          <p className="mt-0.5 text-caption-md text-text-secondary">
            {/* The date that matters differs by status: when the money moved,
                or when it was promised. Showing "created" on a completed
                refund invites the customer's "but you said the 3rd". */}
            {refund.status === 'completed' && refund.refunded_at
              ? `Sent ${formatDate(refund.refunded_at)}`
              : `Recorded ${formatDate(refund.created_at)}`}
            {refund.actor_email ? ` by ${refund.actor_email}` : ''}
          </p>

          {refund.reference && (
            <p className="mt-0.5 font-mono text-caption-md text-text-secondary">
              Ref {refund.reference}
            </p>
          )}

          {refund.note && (
            <p className="mt-1 break-words text-caption-md text-text-secondary">
              &ldquo;{refund.note}&rdquo;
            </p>
          )}

          {refund.status === 'pending' && (
            <PendingActions refund={refund} saving={saving} onSettle={onSettle} />
          )}
        </li>
      ))}
    </ul>
  );
}
