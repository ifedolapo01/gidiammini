/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/RefundForm.tsx
//
// Issuing a refund, full or partial.
//
// The refundable ceiling is stated in words above the amount field and
// enforced on it, because the mistake this form exists to prevent is not a
// typo — it is refunding against an order that was only part paid, or
// refunding twice. The number comes from the server; nothing here recomputes
// it.
//
// "Already sent" is a checkbox rather than a separate flow, because a cash
// refund over the counter is agreed and settled in the same second, while a
// bank transfer is not. Leaving it unticked records the promise, which is what
// stops the customer chasing it.
//
// Only rendered when there is something left to refund — RefundPanel decides
// that, so this form never has to describe its own absence.
//
// Slightly over the 200-line guideline, and left that way deliberately: what
// remains is one form, and every field on it is bound to the same piece of
// state and the same submit. Splitting it would put the amount in one file and
// the ceiling it is validated against in another, which is the one relationship
// a reader most needs to see at once.
'use client';

import { useState } from 'react';
import { Button, Input, Select, Textarea, FieldError, fieldErrorId } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import {
  REFUND_REASONS,
  REFUND_METHODS,
  REFUND_METHOD_LABELS,
  findRefundReason,
  type RefundMethod,
} from '@/lib/commerce/refund-reasons';
import type { OrderRefundTotals } from '@/types/order';
import type { NewRefund } from '../hooks/useOrderRefunds';

interface RefundFormProps {
  totals: OrderRefundTotals;
  saving: boolean;
  onSubmit: (refund: NewRefund) => Promise<boolean>;
}

export default function RefundForm({ totals, saving, onSubmit }: RefundFormProps) {
  const [amount, setAmount] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [method, setMethod] = useState<RefundMethod>('transfer');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [settled, setSettled] = useState(false);
  const [notify, setNotify] = useState(true);
  const [touched, setTouched] = useState(false);

  const reason = findRefundReason(reasonCode);
  const value = Number(amount);
  const amountValid = Number.isFinite(value) && value > 0 && value <= totals.refundable;

  const chooseReason = (code: string) => {
    setReasonCode(code);
    // A ground that normally means the whole order pre-fills the whole
    // refundable balance. Still editable — "normally" is not "always".
    const chosen = findRefundReason(code);
    if (chosen?.usuallyFull && !amount) setAmount(String(totals.refundable));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!amountValid || !reasonCode) return;

    const ok = await onSubmit({
      amount: value,
      method,
      reason_code: reasonCode,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      settled,
      notify,
    });

    if (ok) {
      setAmount('');
      setReasonCode('');
      setReference('');
      setNote('');
      setSettled(false);
      setTouched(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-surface border border-border p-3">
      <p className="text-body-sm text-text-secondary">
        <span className="font-semibold text-text-primary">{formatCurrency(totals.refundable)}</span>{' '}
        can be refunded — that is what was received, less what has already gone back.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="refund-amount" className="mb-1 block text-body-sm font-medium text-text-primary">
            Amount (₦)
          </label>
          <Input
            id="refund-amount"
            type="number"
            min={0}
            max={totals.refundable}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            invalid={touched && !amountValid}
            aria-describedby={touched && !amountValid ? fieldErrorId('amount') : undefined}
          />
          <FieldError id={fieldErrorId('amount')}>
            {touched && !amountValid
              ? `Enter an amount between 0 and ${formatCurrency(totals.refundable)}.`
              : undefined}
          </FieldError>
        </div>

        <div>
          <label htmlFor="refund-method" className="mb-1 block text-body-sm font-medium text-text-primary">
            How it goes back
          </label>
          <Select
            id="refund-method"
            value={method}
            onChange={(event) => setMethod(event.target.value as RefundMethod)}
          >
            {REFUND_METHODS.map((option) => (
              <option key={option} value={option}>{REFUND_METHOD_LABELS[option]}</option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <label htmlFor="refund-reason" className="mb-1 block text-body-sm font-medium text-text-primary">
          Why
        </label>
        <Select
          id="refund-reason"
          value={reasonCode}
          onChange={(event) => chooseReason(event.target.value)}
          invalid={touched && !reasonCode}
        >
          <option value="">Choose a reason…</option>
          {REFUND_REASONS.map((option) => (
            <option key={option.code} value={option.code}>{option.label}</option>
          ))}
        </Select>
        {reason && <p className="mt-1 text-caption-md text-text-secondary">{reason.hint}</p>}
        <FieldError id={fieldErrorId('reason_code')}>
          {touched && !reasonCode ? 'Choose why this refund is being issued.' : undefined}
        </FieldError>
      </div>

      <div>
        <label htmlFor="refund-reference" className="mb-1 block text-body-sm font-medium text-text-primary">
          Transfer reference (optional)
        </label>
        <Input
          id="refund-reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="What the customer will see on their statement"
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor="refund-note" className="mb-1 block text-body-sm font-medium text-text-primary">
          Note (optional)
        </label>
        <Textarea
          id="refund-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Kept on the order. Added to the customer's email if you send one."
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settled}
            onChange={(event) => setSettled(event.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          <span className="text-body-sm text-text-primary">
            The money has already gone out
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => setNotify(event.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          <span className="text-body-sm text-text-primary">Email the customer</span>
        </label>
      </div>

      <Button type="submit" loading={saving} className="w-full sm:w-auto">
        {settled ? 'Record refund as sent' : 'Agree refund'}
      </Button>
    </form>
  );
}
