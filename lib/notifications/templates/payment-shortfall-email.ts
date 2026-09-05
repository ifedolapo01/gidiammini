// lib/notifications/templates/payment-shortfall-email.ts
// "We got some of it" — the email a part payment earns.
//
// This is the case the old workflow had no answer for. A customer who
// transferred 18,000 against a 20,000 order either had their order confirmed
// (and the shop quietly lost 2,000) or was left in 'pending' with no idea
// anything was wrong. Neither is a message.
//
// The tone matters: their money did arrive and is credited. The email
// acknowledges it by name and amount before it asks for the balance, because
// "your payment failed" to someone who has genuinely paid is how a shop loses
// a customer it had already sold to.
import { formatCurrency } from '@/lib/commerce/pricing';
import { buildTrackOrderButton } from './track-order-cta';
import { buildEmailShell } from './email-shell';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';

/** Amber: something needs doing, nothing has gone wrong. */
const ACCENT = '#b45309';

export interface PaymentShortfallEmailParams {
  orderNumber: string;
  customerName: string;
  /** What the order asked for. */
  expected: number;
  /** Credited on this receipt. */
  received: number;
  /** Credited in total, including any earlier payment. */
  receivedTotal: number;
  /** Still owed. */
  outstanding: number;
  /** The verifier's own words, where they added any. */
  note?: string | null;
}

export interface PaymentShortfallEmailContent {
  subject: string;
  html: string;
}

export function buildPaymentShortfallEmail(
  params: PaymentShortfallEmailParams
): PaymentShortfallEmailContent {
  const { orderNumber, customerName, expected, received, receivedTotal, outstanding, note } = params;

  // Only worth showing when an earlier payment exists — otherwise it is the
  // same number twice and reads as a mistake.
  const showsRunningTotal = receivedTotal > received;

  const body = `
        <div style="text-align: center;">
          <h2>Order #${escapeHtml(orderNumber)}</h2>
          <p>We have received part of your payment.</p>
        </div>

        <div class="panel">
          <p>Thank you — we confirmed <strong>${formatCurrency(received)}</strong> against this order. There is a balance still outstanding.</p>

          <table class="figures">
            <tr><td>Order total</td><td>${formatCurrency(expected)}</td></tr>
            ${showsRunningTotal ? `<tr><td>Received so far</td><td>${formatCurrency(receivedTotal)}</td></tr>` : ''}
            <tr><td>Balance to pay</td><td style="color: ${ACCENT};">${formatCurrency(outstanding)}</td></tr>
          </table>

          <p>Please transfer the balance of <strong>${formatCurrency(outstanding)}</strong> to the same account you used before, then upload the new receipt. We will confirm your order as soon as it arrives.</p>
          ${note ? `<p style="color: #4b5563; font-style: italic;">"${escapeHtmlWithBreaks(note)}"</p>` : ''}
        </div>

        ${buildTrackOrderButton(ACCENT)}

        <p>If you believe you sent the full amount, reply to this email with the transfer details and we will trace it for you — your items stay reserved in the meantime.</p>`;

  return {
    subject: sanitizeHeader(
      `Balance of ${formatCurrency(outstanding)} outstanding on order #${orderNumber}`
    ),
    html: buildEmailShell({
      accentColor: ACCENT,
      heading: '💸 Part Payment Received',
      greeting: customerName,
      body,
      contactPrompt: 'Questions about this balance?',
    }),
  };
}
