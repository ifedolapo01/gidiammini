/** ADMIN layer — what the verifier actually saw, and the two outcomes that
 * credit money.
 *
 * Three fields, and each one is a question the old workflow never asked:
 * how much arrived, under what reference, and on what date. The amount is the
 * important one — verification used to mean "the status is now confirmed",
 * which recorded no figure at all and so could not tell a full payment from a
 * short one.
 *
 * The outcome is not a dropdown. Whether this settles the order is arithmetic
 * the screen can do, so the button that matches the amount typed is the one
 * that lights up, and the one that would contradict it is disabled with the
 * reason shown. Nobody has to hold "is 18,000 enough for this order" in their
 * head.
 */
'use client';

import { useEffect, useState } from 'react';
import { Check, HandCoins } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { settlement, suggestOutcome } from '@/lib/commerce/payment-outcome';
import type { PaymentQueueItem, RecordPaymentInput } from '@/types/payment';
import { PaymentMethodField } from './PaymentMethodField';
import { toReceivedAt, todayInputValue } from '../lib/received-at';

interface VerifyFormProps {
  order: PaymentQueueItem;
  saving: boolean;
  onSubmit: (input: RecordPaymentInput) => void;
  onStartReject: () => void;
}

export function VerifyForm({ order, saving, onSubmit, onStartReject }: VerifyFormProps) {
  const balance = settlement(order.total_amount, order.amount_paid);
  // Prefilled with what is actually owed, not the order total: on a part-paid
  // order those differ, and the figure being confirmed is the balance.
  const suggestedAmount = balance.partial ? balance.outstanding : order.total_amount;

  const [amount, setAmount] = useState(String(suggestedAmount));
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState<RecordPaymentInput['method']>('transfer');
  const [receivedOn, setReceivedOn] = useState(todayInputValue);

  // Switching orders must not carry the previous one's figures across — that
  // is how the wrong amount gets recorded against the wrong customer.
  useEffect(() => {
    setAmount(String(suggestedAmount));
    setReference('');
    setMethod('transfer');
    setReceivedOn(todayInputValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const typed = Number(amount);
  const valid = Number.isFinite(typed) && typed > 0;
  const suggested = valid ? suggestOutcome(order.total_amount, order.amount_paid, typed) : null;
  const shortfall = valid ? settlement(order.total_amount, order.amount_paid + typed) : null;

  const submit = (status: 'verified' | 'short_paid') =>
    onSubmit({
      orderId: order.id,
      status,
      amount: typed,
      method,
      reference: reference.trim() || null,
      receivedAt: toReceivedAt(receivedOn),
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-body-sm font-medium text-text-primary">
            Amount received
          </span>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            size="lg"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            invalid={amount !== '' && !valid}
            className="tabular-nums font-semibold"
            aria-describedby="amount-help"
          />
          <span id="amount-help" className="mt-1 block text-caption-md text-text-secondary">
            {balance.partial
              ? `${formatCurrency(order.amount_paid)} already recorded. Balance ${formatCurrency(balance.outstanding)}.`
              : `The order asks for ${formatCurrency(order.total_amount)}.`}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-body-sm font-medium text-text-primary">
            Date received
          </span>
          <Input
            type="date"
            size="lg"
            value={receivedOn}
            max={todayInputValue()}
            onChange={(event) => setReceivedOn(event.target.value)}
            aria-describedby="date-help"
          />
          <span id="date-help" className="mt-1 block text-caption-md text-text-secondary">
            The date on the receipt, not today — that is what reconciles.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-body-sm font-medium text-text-primary">
          Bank reference <span className="font-normal text-text-secondary">(optional)</span>
        </span>
        <Input
          size="lg"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="e.g. 000017250904123456789"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="reference-help"
        />
        <span id="reference-help" className="mt-1 block text-caption-md text-text-secondary">
          Copy it off the receipt. It is how this payment is found again on a statement, and how
          a duplicate transfer is caught.
        </span>
      </label>

      <PaymentMethodField value={method} onChange={setMethod} />

      {/* The consequence of what has been typed, before anything is pressed. */}
      {shortfall && !shortfall.settled && (
        <p className="rounded-control border border-warning-border bg-warning-background px-3 py-2 text-body-sm text-warning">
          That leaves <strong>{formatCurrency(shortfall.outstanding)}</strong> outstanding — record it
          as a short payment and the customer is emailed the balance.
        </p>
      )}
      {shortfall && shortfall.overpaid > 0 && (
        <p className="rounded-control border border-info-border bg-info-background px-3 py-2 text-body-sm text-info">
          That is <strong>{formatCurrency(shortfall.overpaid)}</strong> more than the order asks for.
          Verifying will confirm the order; the difference stays on the record.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          className="flex-1 font-semibold"
          disabled={!valid || suggested !== 'verified'}
          loading={saving && suggested === 'verified'}
          onClick={() => submit('verified')}
        >
          <Check className="size-5" aria-hidden="true" />
          Verified — confirm order
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1 font-semibold"
          disabled={!valid || suggested !== 'short_paid'}
          loading={saving && suggested === 'short_paid'}
          onClick={() => submit('short_paid')}
        >
          <HandCoins className="size-5" aria-hidden="true" />
          Short paid — email balance
        </Button>
      </div>

      <button
        type="button"
        onClick={onStartReject}
        disabled={saving}
        className="min-h-11 w-full rounded-control text-body-sm font-medium text-destructive hover:bg-destructive-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus disabled:opacity-50"
      >
        No money arrived — reject this receipt
      </button>
    </div>
  );
}
