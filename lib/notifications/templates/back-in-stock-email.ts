// lib/notifications/templates/back-in-stock-email.ts
// The mail someone gets when the product they asked about is buyable again.
//
// Kept deliberately short. The recipient asked one question — "tell me when
// this is back" — and the answer is the product name, that it is back, and a
// link straight to it. Anything else is an unrequested newsletter, and this
// list only stays worth having as long as it is never used as one.
//
// A restock is also a race: whoever asked is not the only person who can buy
// it, so the mail says plainly that stock is limited rather than implying it
// is being held for them.
import { escapeHtml, sanitizeHeader } from '@/lib/notifications/escape-html';

export interface BackInStockEmailParams {
  productName: string;
  productUrl: string;
  /** Shown only when the restock was of one specific variant. */
  variantLabel?: string | null;
}

export interface BackInStockEmailContent {
  subject: string;
  html: string;
}

export function buildBackInStockEmail(params: BackInStockEmailParams): BackInStockEmailContent {
  const { productName, productUrl, variantLabel } = params;

  const subject = sanitizeHeader(`Back in stock: ${productName}`);
  const variantLine = variantLabel
    ? `<p style="margin: 8px 0 0; color: #6b7280;">Restocked: <strong>${escapeHtml(variantLabel)}</strong></p>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #047857; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .product-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #047857; }
        .cta { display: inline-block; background: #047857; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; margin-top: 8px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>It's back in stock</h1>
      </div>
      <div class="content">
        <div class="product-box">
          <h2 style="margin: 0;">${escapeHtml(productName)}</h2>
          ${variantLine}
          <p style="margin-top: 16px;">You asked us to let you know when this was available again — it is, as of today.</p>
          <div style="text-align: center;">
            <a href="${escapeHtml(productUrl)}" class="cta">View the product</a>
          </div>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          We couldn't hold one back for you — restocked items sell in the order
          people check out, so it's worth a look soon.
        </p>

        <div class="footer">
          <p>You received this because you asked to be told when this product returned. It's a one-off — you're not subscribed to anything.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
