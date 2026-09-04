// lib/notifications/templates/abandoned-cart-email.ts
// "You left this behind."
//
// The highest-ROI email in commerce, and the easiest one to get wrong. It goes
// to somebody who typed their address into a form and then left, so it earns
// its place by being useful rather than persistent:
//
//   * It shows the actual basket, with pictures. The point is recognition —
//     "oh, that" — not persuasion.
//   * It carries no discount. A shop that trains people to abandon carts for a
//     voucher has taught them to abandon carts.
//   * One link to resume, one to stop. Unsubscribing is a visible, one-tap
//     thing, not four-point grey text.
//   * There are two of these, ever. The second says a little more plainly that
//     stock is not held, because on a transfer-first checkout the honest risk
//     is that it sells before they come back.
import { escapeHtml, sanitizeHeader } from '@/lib/notifications/escape-html';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { CartEmailLine } from '@/lib/commerce/abandoned-cart';

/** Storefront pink — this goes to a shopper. */
const ACCENT = '#db2777';

export interface AbandonedCartEmailParams {
  customerName: string | null;
  lines: CartEmailLine[];
  subtotal: number;
  resumeUrl: string;
  optOutUrl: string;
  /** Which of the two this is. Changes the tone, not the contents. */
  stage: 'first' | 'second';
}

export interface AbandonedCartEmailContent {
  subject: string;
  html: string;
}

function itemRow(line: CartEmailLine): string {
  const variant = line.variant
    ? `<div style="color:#6b7280;font-size:13px;">${escapeHtml(line.variant)}</div>`
    : '';

  return `
    <tr>
      <td style="padding:12px 0;width:72px;vertical-align:top;">
        ${
          line.image
            ? `<img src="${escapeHtml(line.image)}" alt="" width="64" height="64" style="width:64px;height:64px;object-fit:cover;border-radius:8px;display:block;">`
            : ''
        }
      </td>
      <td style="padding:12px 0 12px 12px;vertical-align:top;">
        <div style="font-weight:600;">${escapeHtml(line.name)}</div>
        ${variant}
        <div style="color:#6b7280;font-size:13px;">Qty ${line.quantity}</div>
      </td>
      <td style="padding:12px 0;text-align:right;vertical-align:top;white-space:nowrap;">
        ${escapeHtml(formatCurrency(line.price * line.quantity))}
      </td>
    </tr>`;
}

export function buildAbandonedCartEmail(
  params: AbandonedCartEmailParams
): AbandonedCartEmailContent {
  const { customerName, lines, subtotal, resumeUrl, optOutUrl, stage } = params;

  const first = stage === 'first';
  const greeting = customerName?.trim() ? `Hello ${escapeHtml(customerName.trim())},` : 'Hello,';

  const subject = sanitizeHeader(
    first ? 'You left something in your cart' : 'Still thinking it over?'
  );

  const opening = first
    ? 'Your basket is still here, exactly as you left it. Nothing has been ordered yet — pick up where you stopped whenever you are ready.'
    : 'Your basket is still saved. We do not hold stock, though, so if one of these is on your list it is worth finishing before somebody else does.';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${ACCENT}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .cta { display: inline-block; background: ${ACCENT}; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${first ? 'Your basket is waiting' : 'Still in your basket'}</h1>
        <p>${greeting}</p>
      </div>
      <div class="content">
        <p>${opening}</p>

        <div class="card">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${lines.map(itemRow).join('')}
            <tr>
              <td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:12px;font-weight:700;">Subtotal</td>
              <td style="border-top:1px solid #e5e7eb;padding-top:12px;text-align:right;font-weight:700;white-space:nowrap;">
                ${escapeHtml(formatCurrency(subtotal))}
              </td>
            </tr>
          </table>

          <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">
            Delivery is worked out at checkout, from your state.
          </p>

          <div style="text-align:center;margin-top:20px;">
            <a href="${escapeHtml(resumeUrl)}" class="cta">Finish my order</a>
          </div>
        </div>

        <p style="color:#6b7280;font-size:14px;">
          You can pay by card, bank transfer or USSD — or transfer yourself and upload
          the receipt, whichever you prefer. Any questions at all, just reply to this
          email.
        </p>

        <div class="footer">
          <p>
            You are getting this because you started a checkout with this address.
            ${first ? 'We will send one more reminder and then stop.' : 'This is the last one.'}
          </p>
          <p>
            <a href="${escapeHtml(optOutUrl)}" style="color:#6b7280;">
              Do not email me about my basket
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
