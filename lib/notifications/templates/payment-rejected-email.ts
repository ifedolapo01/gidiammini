// lib/notifications/templates/payment-rejected-email.ts
// "We could not verify this" — with the one thing the customer has to do next.
//
// A rejection with no instruction is worse than silence: the customer knows
// something is wrong and has to ask the shop what, which is the support
// message this email exists to prevent. So the next step is not optional
// copy — it comes from the ground the verifier picked (see
// lib/commerce/payment-rejection.ts) and every ground has one.
//
// The order is not cancelled by this email, and it says so. Cancelling is a
// separate decision a person makes later; a customer whose bank was simply
// slow should not read this and assume their order is gone.
import { formatCurrency } from '@/lib/commerce/pricing';
import { rejectionMessage } from '@/lib/commerce/payment-rejection';
import { buildTrackOrderButton } from './track-order-cta';
import { buildEmailShell } from './email-shell';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';

/** Red: the customer must act, and nothing has been credited. */
const ACCENT = '#b91c1c';

export interface PaymentRejectedEmailParams {
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  /** Credited against this order by earlier payments, if any. This refusal
   *  credits nothing, but an earlier part payment still stands and the
   *  customer must not read this email as having lost it. */
  receivedTotal: number;
  /** A PaymentRejectionCode. Unknown codes fall back to the generic ground. */
  reasonCode: string | null;
  /** The verifier's own sentence, where they wrote one. Appended to the
   *  canonical next step rather than replacing it. */
  note?: string | null;
}

export interface PaymentRejectedEmailContent {
  subject: string;
  html: string;
}

export function buildPaymentRejectedEmail(
  params: PaymentRejectedEmailParams
): PaymentRejectedEmailContent {
  const { orderNumber, customerName, totalAmount, receivedTotal, reasonCode, note } = params;
  const { headline, nextStep, detail } = rejectionMessage(reasonCode, note);

  const body = `
        <div style="text-align: center;">
          <h2>Order #${escapeHtml(orderNumber)}</h2>
          <p>${escapeHtml(headline)}.</p>
        </div>

        <div class="panel">
          <p><strong>What to do next</strong></p>
          <p>${escapeHtml(nextStep)}</p>
          ${detail ? `<p style="color: #4b5563; font-style: italic;">"${escapeHtmlWithBreaks(detail)}"</p>` : ''}
        </div>

        <table class="figures">
          <tr><td>Order total</td><td>${formatCurrency(totalAmount)}</td></tr>
          <tr><td>Confirmed so far</td><td>${formatCurrency(receivedTotal)}</td></tr>
        </table>

        <p>Your order has <strong>not</strong> been cancelled — it is waiting for a payment we can confirm. Nothing else is needed from you beyond the step above.</p>

        ${buildTrackOrderButton(ACCENT)}`;

  return {
    subject: sanitizeHeader(`Action needed on your payment for order #${orderNumber}`),
    html: buildEmailShell({
      accentColor: ACCENT,
      heading: '⚠️ We Could Not Verify Your Payment',
      greeting: customerName,
      body,
      contactPrompt: 'Need help with this?',
    }),
  };
}
