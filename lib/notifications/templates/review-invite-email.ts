// lib/notifications/templates/review-invite-email.ts
// The mail that asks a customer what they thought, once their order arrived.
//
// It is sent to someone who has already paid, so it asks for exactly one thing
// and asks once. No discount code in exchange for a review — a paid-for review
// is not social proof, and the whole point of gating this on a real purchase is
// that the rating means something.
//
// The link carries the invite token, which is the customer's proof of purchase.
// Nothing else in the mail matters as much: no login, no order number to type,
// no form to find. One tap from the inbox to the stars.
import { escapeHtml, sanitizeHeader } from '@/lib/notifications/escape-html';

/** Storefront pink — this one goes to shoppers, not to the admin. */
const ACCENT = '#db2777';

export interface ReviewInviteEmailParams {
  orderNumber: string;
  customerName: string;
  /** Absolute /review/<token> URL. */
  reviewUrl: string;
  /** What they bought, for the "was the X alright?" line. Names only. */
  productNames: string[];
}

export interface ReviewInviteEmailContent {
  subject: string;
  html: string;
}

/** "the Nap Set", "the Nap Set and the Bib", "3 items from your order". */
function describe(productNames: string[]): string {
  const named = productNames.filter(Boolean).map(escapeHtml);

  if (named.length === 0) return 'your order';
  if (named.length === 1) return `the <strong>${named[0]}</strong>`;
  if (named.length === 2) return `the <strong>${named[0]}</strong> and the <strong>${named[1]}</strong>`;
  return `the <strong>${named[0]}</strong> and ${named.length - 1} other items`;
}

export function buildReviewInviteEmail(params: ReviewInviteEmailParams): ReviewInviteEmailContent {
  const { orderNumber, customerName, reviewUrl, productNames } = params;

  // Their name, not the shop's — this is a question, and a question comes from
  // a person.
  const subject = sanitizeHeader(`How did we do, ${customerName.split(' ')[0] || 'there'}?`);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${ACCENT}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .ask-box { background: white; padding: 24px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${ACCENT}; }
        .stars { font-size: 28px; letter-spacing: 6px; color: ${ACCENT}; margin: 0 0 8px; }
        .cta { display: inline-block; background: ${ACCENT}; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; margin-top: 8px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>How did we do?</h1>
        <p>Hello ${escapeHtml(customerName)},</p>
      </div>
      <div class="content">
        <p>Your order <strong>#${escapeHtml(orderNumber)}</strong> has arrived, so there is only one thing left to ask: how was it?</p>

        <div class="ask-box">
          <p class="stars">★ ★ ★ ★ ★</p>
          <p style="margin: 0;">Tell us about ${describe(productNames)} — the fit, the fabric, whether it was what you expected. A photo of it being worn is worth more than anything we could write ourselves.</p>
          <div style="text-align: center;">
            <a href="${escapeHtml(reviewUrl)}" class="cta">Leave a review</a>
          </div>
          <p style="margin: 12px 0 0; color: #6b7280; font-size: 13px; text-align: center;">Takes about a minute. No account, no password.</p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Your review helps the next parent decide — most of them are buying from
          us for the first time, and yours is the only evidence they have that
          somebody did it before them. If something went wrong instead, tell us
          there too: we would rather fix it than not hear about it.
        </p>

        <div class="footer">
          <p>You received this because you ordered from us and it was delivered. It's a one-off — you're not subscribed to anything.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
