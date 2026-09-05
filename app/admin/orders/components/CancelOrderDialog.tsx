/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/CancelOrderDialog.tsx
//
// What replaces window.confirm.
//
// The old confirm asked "are you sure?", which is a question nobody has ever
// answered no to, and recorded nothing. This asks the only question worth
// asking — why — and it asks it from a fixed list so the answers can be
// counted. The free-text note sits underneath for the part no list can hold.
//
// It also does the thing the confirm could not: when the order has been paid
// for, it says so, in money, before the button is pressed. Cancelling a paid
// order without noticing is how a customer ends up chasing a refund nobody
// knew was owed.
'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Modal, Textarea, FieldError, fieldErrorId } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { orderSettlement } from '@/lib/commerce/order-money';
import {
  CANCELLATION_REASONS,
  findCancellationReason,
  type CancellationCode,
} from '@/lib/commerce/cancellation-reasons';
import type { TransitionExtras } from '../hooks/useStatusTransition';

interface CancelOrderDialogProps {
  order: {
    order_number: string;
    total_amount: number;
    amount_paid?: number | null;
    amount_refunded?: number | null;
  };
  saving: boolean;
  onClose: () => void;
  onConfirm: (extras: TransitionExtras) => void;
}

export default function CancelOrderDialog({ order, saving, onClose, onConfirm }: CancelOrderDialogProps) {
  const [code, setCode] = useState<CancellationCode | ''>('');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [touched, setTouched] = useState(false);

  const reason = findCancellationReason(code);
  const settlement = orderSettlement(order);
  const noteRequired = reason?.requiresNote === true;
  const noteMissing = noteRequired && !note.trim();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!code || noteMissing) return;
    onConfirm({ reason_code: code, reason: note.trim() || undefined, notify });
  };

  return (
    <Modal open onClose={onClose} title={`Cancel order ${order.order_number}`} size="lg" scrollable>
      <form onSubmit={submit} className="space-y-5">
        {/* The money warning, before anything else on the screen. */}
        {settlement.net > 0 && (
          <div className="flex gap-3 rounded-surface border border-warning-border bg-warning-background p-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-body-sm font-semibold text-text-primary">
                {formatCurrency(settlement.net)} has been received on this order.
              </p>
              <p className="mt-0.5 text-caption-md text-text-secondary">
                Cancelling does not refund it. Use the Refunds tab afterwards to send it back and
                record the reference.
              </p>
            </div>
          </div>
        )}

        <fieldset>
          <legend className="mb-2 text-body-sm font-medium text-text-primary">
            Why is this order being cancelled?
          </legend>

          <div className="space-y-1.5">
            {CANCELLATION_REASONS.map((option) => (
              <label
                key={option.code}
                className={`flex cursor-pointer gap-3 rounded-control border p-3 transition-colors ${
                  code === option.code
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-surface-hover'
                }`}
              >
                <input
                  type="radio"
                  name="cancellation-reason"
                  value={option.code}
                  checked={code === option.code}
                  onChange={() => setCode(option.code)}
                  className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                />
                <span>
                  <span className="block text-body-sm font-medium text-text-primary">
                    {option.label}
                  </span>
                  <span className="block text-caption-md text-text-secondary">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <FieldError id={fieldErrorId('reason_code')}>
            {touched && !code ? 'Choose why this order is being cancelled.' : undefined}
          </FieldError>
        </fieldset>

        <div>
          <label htmlFor="cancel-note" className="mb-1.5 block text-body-sm font-medium text-text-primary">
            Note {noteRequired ? '(required)' : '(optional)'}
          </label>
          <Textarea
            id="cancel-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Kept on the order, and added to the customer's email."
            invalid={touched && noteMissing}
            aria-describedby={touched && noteMissing ? fieldErrorId('reason') : undefined}
          />
          <FieldError id={fieldErrorId('reason')}>
            {touched && noteMissing ? 'This reason needs a sentence explaining it.' : undefined}
          </FieldError>
        </div>

        {/* The customer message is shown, not described. An admin about to send
            it should be able to read it. */}
        {reason && notify && (
          <div className="rounded-surface bg-background-secondary p-3">
            <p className="text-caption-md font-medium text-text-secondary">The customer will be told:</p>
            <p className="mt-1 whitespace-pre-line text-body-sm text-text-primary">
              {reason.customerMessage}
              {note.trim() ? `\n\n${note.trim()}` : ''}
            </p>
          </div>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => setNotify(event.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          <span className="text-body-sm text-text-primary">Email and text the customer</span>
        </label>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Keep this order
          </Button>
          <Button type="submit" variant="destructive" loading={saving}>
            Cancel order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
