/** ADMIN layer — every decision already recorded against this order.
 *
 * On the verification screen rather than buried in the order's history,
 * because it answers the question the verifier is about to ask: has somebody
 * already looked at this? A part-paid order shows the payment that got it
 * there, and a rejected one shows why — so the same receipt is not refused
 * twice on two different grounds, and a top-up is not mistaken for a fresh
 * first payment.
 */
'use client';

import { Ban, Check, HandCoins } from 'lucide-react';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';
import { findRejectionReason } from '@/lib/commerce/payment-rejection';
import type { OrderPayment, PaymentStatus } from '@/types/payment';

const APPEARANCE: Record<PaymentStatus, { icon: typeof Check; tone: string; label: string }> = {
  verified: { icon: Check, tone: 'text-success', label: 'Verified' },
  short_paid: { icon: HandCoins, tone: 'text-warning', label: 'Short paid' },
  rejected: { icon: Ban, tone: 'text-destructive', label: 'Rejected' },
};

interface PaymentTrailProps {
  payments: OrderPayment[];
}

export function PaymentTrail({ payments }: PaymentTrailProps) {
  if (payments.length === 0) return null;

  return (
    <section className="rounded-surface border border-border bg-surface p-4">
      <h3 className="text-body-sm font-semibold text-text-primary">
        Already recorded ({payments.length})
      </h3>

      <ul className="mt-3 space-y-3">
        {payments.map((payment) => {
          const { icon: Icon, tone, label } = APPEARANCE[payment.status] ?? APPEARANCE.rejected;
          const reason = findRejectionReason(payment.reason_code);

          return (
            <li key={payment.id} className="flex gap-3">
              <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} aria-hidden="true" />

              <div className="min-w-0 flex-1">
                <p className="text-body-sm text-text-primary">
                  <span className="font-semibold">{label}</span>
                  {payment.status !== 'rejected' && (
                    <>
                      {' · '}
                      <span className="tabular-nums font-medium">{formatCurrency(payment.amount)}</span>
                    </>
                  )}
                  {reason && <>{' · '}{reason.label}</>}
                </p>

                <p className="text-caption-md text-text-secondary">
                  {formatDate(payment.received_at)}
                  {payment.reference && <> · ref {payment.reference}</>}
                  {' · '}
                  {payment.actor_email ?? 'System'}
                </p>

                {payment.note && (
                  <p className="mt-1 text-caption-md italic text-text-secondary">“{payment.note}”</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
