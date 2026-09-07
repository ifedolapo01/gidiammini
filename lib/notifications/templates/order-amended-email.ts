// lib/notifications/templates/order-amended-email.ts
// "Here is what your order says now."
//
// An edit made without telling the customer is how a shop ends up delivering
// something the buyer did not agree to and only finds out at the door. The
// email therefore leads with the changes, in the words diffOrderLines produced,
// and then shows the whole new total broken down — because the first question
// after "what changed" is always "so what do I pay".
//
// The balance line is the important one. An edit that raises the total leaves
// money owed on an order the customer thought was settled, and saying so here
// is the difference between a top-up transfer and a doorstep argument.
import { formatCurrency } from '@/lib/commerce/pricing';
import { buildTrackOrderButton } from './track-order-cta';
import {
  buildEmailShell, panelStyle, FIGURES_TABLE_STYLE, FIGURES_TD_STYLE, figuresLastTdStyle,
} from './email-shell';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';

/** Blue: informational. Nothing has gone wrong and nothing is being refused. */
const ACCENT = '#2563eb';

export interface OrderAmendedEmailParams {
  orderNumber: string;
  customerName: string;
  /** One sentence per change, already phrased — see describeLineChange(). */
  changes: string[];
  itemsSubtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  discountReason?: string | null;
  totalAmount: number;
  /** What the order came to before this edit, for the "was / now" line. */
  previousTotal: number;
  /** Credited against the order so far. */
  amountPaid: number;
  /** The admin's own words about why, where they wrote any. */
  note?: string | null;
}

export interface OrderAmendedEmailContent {
  subject: string;
  html: string;
}

/** Positive when the customer still owes; negative when they are owed. */
function balanceOf(total: number, paid: number): number {
  return Math.round((total - paid) * 100) / 100;
}

function balancePanel(total: number, paid: number): string {
  const balance = balanceOf(total, paid);

  // Nothing was ever paid, so there is no balance to talk about — the order
  // total already says everything.
  if (paid <= 0) return '';

  if (balance > 0) {
    return `
        <div style="${panelStyle('#b45309')}">
          <p><strong>There is now ${formatCurrency(balance)} left to pay.</strong></p>
          <p>Please transfer the balance to the same account you used before and upload the receipt, and we will carry on with your order.</p>
        </div>`;
  }

  if (balance < 0) {
    return `
        <div style="${panelStyle('#10b981')}">
          <p><strong>You have paid ${formatCurrency(-balance)} more than this order now comes to.</strong></p>
          <p>We will refund the difference. If you would rather leave it against a future order, reply to this email and we will hold it for you.</p>
        </div>`;
  }

  return `
        <div style="${panelStyle('#10b981')}">
          <p><strong>This order is fully paid.</strong> Nothing further is owed.</p>
        </div>`;
}

export function buildOrderAmendedEmail(params: OrderAmendedEmailParams): OrderAmendedEmailContent {
  const {
    orderNumber, customerName, changes,
    itemsSubtotal, taxAmount, shippingAmount, discountAmount, discountReason,
    totalAmount, previousTotal, amountPaid, note,
  } = params;

  const changeList = changes.length
    ? `<ul>${changes.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
    : '<p>The items are unchanged. Only the amount due has been adjusted.</p>';

  const body = `
        <div style="text-align: center;">
          <h2>Order #${escapeHtml(orderNumber)}</h2>
          <p>We have updated your order.</p>
        </div>

        <div style="${panelStyle(ACCENT)}">
          <p><strong>What changed</strong></p>
          ${changeList}
          ${note ? `<p style="color: #4b5563; font-style: italic;">"${escapeHtmlWithBreaks(note)}"</p>` : ''}
        </div>

        <div style="${panelStyle(ACCENT)}">
          <p><strong>Your order now</strong></p>
          <table style="${FIGURES_TABLE_STYLE}">
            <tr><td style="${FIGURES_TD_STYLE}">Items</td><td style="${figuresLastTdStyle()}">${formatCurrency(itemsSubtotal)}</td></tr>
            ${taxAmount > 0 ? `<tr><td style="${FIGURES_TD_STYLE}">Tax</td><td style="${figuresLastTdStyle()}">${formatCurrency(taxAmount)}</td></tr>` : ''}
            ${shippingAmount > 0 ? `<tr><td style="${FIGURES_TD_STYLE}">Delivery</td><td style="${figuresLastTdStyle()}">${formatCurrency(shippingAmount)}</td></tr>` : ''}
            ${discountAmount > 0 ? `<tr><td style="${FIGURES_TD_STYLE}">Discount${discountReason ? ` (${escapeHtml(discountReason)})` : ''}</td><td style="${figuresLastTdStyle()}">-${formatCurrency(discountAmount)}</td></tr>` : ''}
            <tr><td style="${FIGURES_TD_STYLE}"><strong>Total</strong></td><td style="${figuresLastTdStyle(`color: ${ACCENT};`)}">${formatCurrency(totalAmount)}</td></tr>
            ${previousTotal !== totalAmount ? `<tr><td style="${FIGURES_TD_STYLE} color: #6b7280;">Previously</td><td style="${figuresLastTdStyle('color: #6b7280; font-weight: normal;')}">${formatCurrency(previousTotal)}</td></tr>` : ''}
          </table>
        </div>

        ${balancePanel(totalAmount, amountPaid)}

        ${buildTrackOrderButton(ACCENT)}

        <p>If any of this is not what you agreed, reply to this email straight away and we will put it right before your order goes out.</p>`;

  return {
    subject: sanitizeHeader(`Your order #${orderNumber} has been updated`),
    html: buildEmailShell({
      accentColor: ACCENT,
      heading: '✏️ Order Updated',
      greeting: customerName,
      body,
      contactPrompt: 'Questions about these changes?',
    }),
  };
}
