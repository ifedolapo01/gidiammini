// lib/notifications/templates/wishlist-alert-email.ts
//
// The two mails a saved product can earn: it got cheaper, or it came back.
//
// Written to the same rule as the stock-alert mail — the recipient saved one
// product, and the mail is about that product and nothing else. No other
// suggestions, no "while you're here". A wishlist list is only worth having as
// long as it is never used as a newsletter, and the moment it carries a second
// product it has become one.
//
// One builder for both, because they differ in three strings and a colour and
// two near-identical templates would drift.
import { escapeHtml, sanitizeHeader } from '@/lib/notifications/escape-html';
import { formatCurrency } from '@/lib/commerce/pricing';
import { priceDropAmount, type WishlistAlert } from '@/lib/commerce/wishlist-alerts';

export interface WishlistAlertEmailParams {
  alert: WishlistAlert;
  productUrl: string;
  /** Where somebody goes to stop this, which every one of these must offer. */
  wishlistUrl: string;
}

export interface WishlistAlertEmailContent {
  subject: string;
  html: string;
}

interface Copy {
  accent: string;
  subject: string;
  heading: string;
  lead: string;
  /** The line that carries the number, when there is one. */
  detail: string;
  cta: string;
}

function copyFor(alert: WishlistAlert): Copy {
  if (alert.kind === 'back-in-stock') {
    return {
      accent: '#047857',
      subject: `Back in stock: ${alert.productName}`,
      heading: "It's back",
      lead: 'You saved this to your wishlist while it was sold out. It is available again as of today.',
      // Said plainly: it is not being held, and whoever saved it is not the
      // only person who can buy it.
      detail: `<p style="margin: 12px 0 0; color: #6b7280;">Stock is limited and we cannot hold it — first come, first served.</p>`,
      cta: 'Buy it now',
    };
  }

  const saved = priceDropAmount(alert);

  return {
    accent: '#be185d',
    subject: `${alert.productName} is ${formatCurrency(saved)} cheaper`,
    heading: 'The price dropped',
    lead: 'Something on your wishlist costs less than when you saved it.',
    detail: `
      <p style="margin: 12px 0 0; font-size: 18px;">
        <span style="color: #6b7280; text-decoration: line-through;">${escapeHtml(formatCurrency(alert.referencePrice))}</span>
        <strong style="color: #be185d; margin-left: 8px;">${escapeHtml(formatCurrency(alert.price))}</strong>
      </p>
      <p style="margin: 4px 0 0; color: #6b7280;">That is ${escapeHtml(formatCurrency(saved))} less than when you saved it.</p>`,
    cta: 'View the product',
  };
}

export function buildWishlistAlertEmail(
  params: WishlistAlertEmailParams
): WishlistAlertEmailContent {
  const { alert, productUrl, wishlistUrl } = params;
  const copy = copyFor(alert);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${copy.accent}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .product-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${copy.accent}; }
        .cta { display: inline-block; background: ${copy.accent}; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; margin-top: 16px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">${escapeHtml(copy.heading)}</h1>
      </div>
      <div class="content">
        <p style="margin-top: 0;">${escapeHtml(copy.lead)}</p>

        <div class="product-box">
          <h2 style="margin: 0;">${escapeHtml(alert.productName)}</h2>
          ${copy.detail}
          <div style="text-align: center;">
            <a href="${escapeHtml(productUrl)}" class="cta">${escapeHtml(copy.cta)}</a>
          </div>
        </div>

        <div class="footer">
          <p>
            You are getting this because you saved this product to your wishlist.
            Remove it from <a href="${escapeHtml(wishlistUrl)}">your wishlist</a> and we will stop.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject: sanitizeHeader(copy.subject), html };
}
