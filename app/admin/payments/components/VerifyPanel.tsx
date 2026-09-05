/** ADMIN layer — the working surface for one order: who, the receipt, the
 * decision, and what has already been decided.
 *
 * Holds the one piece of state the two forms cannot own between them — whether
 * we are recording money or refusing a receipt — and nothing else. The
 * arithmetic is in payment-outcome.ts, the submit is in useRecordPayment, and
 * the rejection vocabulary is in payment-rejection.ts.
 */
'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Phone } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/commerce/format-date';
import { daysWaiting } from '@/lib/commerce/payment-outcome';
import type { PaymentQueueItem, RecordPaymentInput } from '@/types/payment';
import { ReceiptPane } from './ReceiptPane';
import { VerifyForm } from './VerifyForm';
import { RejectForm } from './RejectForm';
import { PaymentTrail } from './PaymentTrail';

interface VerifyPanelProps {
  order: PaymentQueueItem;
  saving: boolean;
  error: string | null;
  onSubmit: (input: RecordPaymentInput) => void;
  onDismissError: () => void;
}

export function VerifyPanel({ order, saving, error, onSubmit, onDismissError }: VerifyPanelProps) {
  const [rejecting, setRejecting] = useState(false);
  const waited = daysWaiting(order.created_at);

  // A new order in the panel starts on the recording form. Leaving it in
  // reject mode would put a rejection one tap away on an order nobody has
  // looked at yet.
  useEffect(() => {
    setRejecting(false);
    onDismissError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  return (
    <div className="space-y-4">
      <header className="rounded-surface border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-h5 font-bold text-text-primary">{order.customer_name}</h2>
            <p className="text-body-sm text-text-secondary">
              {order.order_number} · placed {formatDate(order.created_at)}
            </p>
          </div>

          {waited > 0 && (
            <Badge tone={waited >= 2 ? 'destructive' : 'warning'}>
              Waiting {waited} day{waited === 1 ? '' : 's'}
            </Badge>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm">
          {/* A tap-to-call link, not text. Half of what this queue cannot
              resolve on the receipt alone is resolved by phoning the customer,
              and this screen is used on a phone. */}
          <a
            href={`tel:${order.customer_phone}`}
            className="flex min-h-11 items-center gap-1.5 font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus"
          >
            <Phone className="size-4" aria-hidden="true" />
            {order.customer_phone}
          </a>

          <Link
            href={`/admin/orders?search=${encodeURIComponent(order.order_number)}`}
            className="flex min-h-11 items-center gap-1.5 font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Open the order
          </Link>
        </div>

        {order.note && (
          <p className="mt-3 rounded-control bg-warning-background px-3 py-2 text-body-sm text-text-primary">
            <span className="font-medium">Customer note:</span> {order.note}
          </p>
        )}
      </header>

      <ReceiptPane order={order} />

      <section className="rounded-surface border border-border bg-surface p-4">
        {error && (
          <p role="alert" className="mb-4 rounded-control border border-destructive-border bg-destructive-background px-3 py-2 text-body-sm font-medium text-destructive">
            {error}
          </p>
        )}

        {rejecting ? (
          <RejectForm
            order={order}
            saving={saving}
            onSubmit={onSubmit}
            onCancel={() => {
              setRejecting(false);
              onDismissError();
            }}
          />
        ) : (
          <VerifyForm
            order={order}
            saving={saving}
            onSubmit={onSubmit}
            onStartReject={() => {
              setRejecting(true);
              onDismissError();
            }}
          />
        )}
      </section>

      <PaymentTrail payments={order.payments ?? []} />
    </div>
  );
}
