/** ADMIN layer — refusing a receipt, on a ground the customer can act on.
 *
 * A rejection has to pick a reason, and the reasons are not free text: each
 * one carries the next step the customer is emailed (see
 * lib/commerce/payment-rejection.ts). That is the difference between "your
 * payment could not be verified", which produces a support message, and
 * "upload a clearer image showing the reference", which produces a clearer
 * image.
 *
 * The extra note is optional and goes to the customer as well, appended to the
 * canonical next step rather than replacing it — a hurried sentence typed on a
 * phone rarely repeats the instruction, and the instruction is the point.
 */
'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Ban } from 'lucide-react';
import { Button, Textarea } from '@/components/ui';
import { PAYMENT_REJECTION_REASONS } from '@/lib/commerce/payment-rejection';
import type { PaymentRejectionCode } from '@/lib/commerce/payment-rejection';
import { cn } from '@/lib/utils';
import type { PaymentQueueItem, RecordPaymentInput } from '@/types/payment';

interface RejectFormProps {
  order: PaymentQueueItem;
  saving: boolean;
  onSubmit: (input: RecordPaymentInput) => void;
  onCancel: () => void;
}

export function RejectForm({ order, saving, onSubmit, onCancel }: RejectFormProps) {
  const [code, setCode] = useState<PaymentRejectionCode | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    setCode(null);
    setNote('');
  }, [order.id]);

  const chosen = PAYMENT_REJECTION_REASONS.find((reason) => reason.code === code);
  // 'Something else' has no ground of its own beyond what is typed, so a note
  // is required there and optional everywhere else.
  const ready = Boolean(code) && (code !== 'other' || note.trim().length > 0);

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-body-sm font-medium text-text-primary">
          Why is this being rejected?
        </legend>
        <div className="space-y-1.5">
          {PAYMENT_REJECTION_REASONS.map((reason) => {
            const active = reason.code === code;

            return (
              <label
                key={reason.code}
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors',
                  'focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-focus',
                  active
                    ? 'border-destructive bg-destructive-background'
                    : 'border-border bg-surface hover:bg-surface-hover',
                )}
              >
                <input
                  type="radio"
                  name="rejection-reason"
                  value={reason.code}
                  checked={active}
                  onChange={() => setCode(reason.code)}
                  className="mt-0.5 size-4 shrink-0 accent-destructive focus:outline-none"
                />
                <span className="min-w-0">
                  <span className="block text-body-sm font-medium text-text-primary">{reason.label}</span>
                  <span className="block text-caption-md text-text-secondary">{reason.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-body-sm font-medium text-text-primary">
          Anything to add{code === 'other' ? '' : ' (optional)'}
          <span className="ml-1 font-normal text-text-secondary">— the customer reads this</span>
        </span>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="e.g. The name on the transfer is different from the name on the order."
        />
      </label>

      {/* Exactly what the customer will be told, before it is sent. Nobody
          should have to guess what a rejection email says. */}
      {chosen && (
        <div className="rounded-control border border-border bg-background-secondary p-3">
          <p className="text-caption-md font-semibold uppercase tracking-wide text-text-secondary">
            The customer will be emailed
          </p>
          <p className="mt-1 text-body-sm font-medium text-text-primary">{chosen.headline}</p>
          <p className="mt-1 text-body-sm text-text-secondary">{chosen.nextStep}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          size="lg"
          variant="destructive"
          className="flex-1 font-semibold"
          disabled={!ready}
          loading={saving}
          onClick={() =>
            onSubmit({
              orderId: order.id,
              status: 'rejected',
              reasonCode: code,
              note: note.trim() || null,
            })
          }
        >
          <Ban className="size-5" aria-hidden="true" />
          Reject and email customer
        </Button>
        <Button size="lg" variant="outline" className="sm:flex-none" disabled={saving} onClick={onCancel}>
          <ArrowLeft className="size-5" aria-hidden="true" />
          Back
        </Button>
      </div>
    </div>
  );
}
