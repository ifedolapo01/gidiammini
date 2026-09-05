// lib/notifications/templates/refund-email.ts
// "Your money is on its way back", and later, "it has gone."
//
// Two emails from one template, because they are the same message at two
// moments and splitting them would mean maintaining the figures twice. Which
// one it is turns entirely on `settled`:
//
//   pending   — the refund has been agreed. This email exists to stop the
//               customer chasing it, so it says what is coming and roughly
//               when, and does not pretend the money has moved.
//   completed — it has actually been sent, with the reference to look for on
//               their statement. That reference is the whole point: "we
//               refunded you" without one is unverifiable and gets chased
//               anyway.
import { formatCurrency } from '@/lib/commerce/pricing';
import { buildEmailShell } from './email-shell';
import { refundMessage } from '@/lib/commerce/refund-reasons';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';

/** Green: money going back to the customer is good news, however it arose. */
const ACCENT = '#10b981';

export interface RefundEmailParams {
  orderNumber: string;
  customerName: string;
  /** This refund. Not the order total, and not the running total. */
  amount: number;
  orderTotal: number;
  /** Refunded against this order in total, this one included. */
  refundedTotal: number;
  /** True once the money has actually left. */
  settled: boolean;
  /** RefundCode — decides the sentence explaining why. */
  reasonCode?: string | null;
  /** The admin's own words, appended to that sentence. */
  note?: string | null;
  /** Bank reference of the outgoing transfer, once there is one. */
  reference?: string | null;
  /** How it went back — "Bank transfer", "Store credit". */
  methodLabel?: string | null;
}

export interface RefundEmailContent {
  subject: string;
  html: string;
}

export function buildRefundEmail(params: RefundEmailParams): RefundEmailContent {
  const {
    orderNumber, customerName, amount, orderTotal, refundedTotal,
    settled, reasonCode, note, reference, methodLabel,
  } = params;

  const isPartial = refundedTotal < orderTotal;

  // Only meaningful once more than this one refund exists; otherwise it is the
  // same figure twice and reads as a mistake.
  const showsRunningTotal = refundedTotal > amount;

  const body = `
        <div style="text-align: center;">
          <h2>Order #${escapeHtml(orderNumber)}</h2>
          <p style="font-size: 24px; font-weight: bold; color: ${ACCENT};">${formatCurrency(amount)}</p>
          <p>${settled ? 'has been refunded to you.' : 'is being refunded to you.'}</p>
        </div>

        <div class="panel">
          <p>${escapeHtmlWithBreaks(refundMessage(reasonCode, note))}</p>

          <table class="figures">
            <tr><td>Order total</td><td>${formatCurrency(orderTotal)}</td></tr>
            <tr><td>${isPartial ? 'Refunded' : 'Refunded in full'}</td><td style="color: ${ACCENT};">${formatCurrency(amount)}</td></tr>
            ${showsRunningTotal ? `<tr><td>Refunded on this order in total</td><td>${formatCurrency(refundedTotal)}</td></tr>` : ''}
            ${methodLabel ? `<tr><td>Sent by</td><td style="font-weight: normal;">${escapeHtml(methodLabel)}</td></tr>` : ''}
            ${reference ? `<tr><td>Reference</td><td style="font-weight: normal; font-family: monospace;">${escapeHtml(reference)}</td></tr>` : ''}
          </table>
        </div>

        ${settled
          ? `<p>Depending on your bank this can take a few working days to show on your statement. If it has not appeared after five working days, reply to this email with the reference above and we will chase it.</p>`
          : `<p>We are sending this back to the account you paid from. You will get another email from us the moment it goes out, with the reference to look for.</p>`}`;

  return {
    subject: sanitizeHeader(
      settled
        ? `${formatCurrency(amount)} refunded on order #${orderNumber}`
        : `Refund of ${formatCurrency(amount)} on the way for order #${orderNumber}`
    ),
    html: buildEmailShell({
      accentColor: ACCENT,
      heading: settled ? '💚 Refund Sent' : '💚 Refund Agreed',
      greeting: customerName,
      body,
      contactPrompt: 'Questions about this refund?',
    }),
  };
}
