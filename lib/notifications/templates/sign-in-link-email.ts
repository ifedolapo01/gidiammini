// lib/notifications/templates/sign-in-link-email.ts
// The email that is the whole login system.
//
// There is no password to remember and none to reset, so this one message is
// the entire credential. That shapes the copy: it says plainly what the link
// does, how long it lasts, and what to do if the request was not theirs —
// because a sign-in email arriving unasked is the one thing a customer should
// act on rather than ignore.
//
// No marketing, no product rail, nothing else clickable. A login email that
// also sells things trains people to click links in login emails.
import { escapeHtml, sanitizeHeader } from '@/lib/notifications/escape-html';

/** Storefront pink — this goes to a shopper. */
const ACCENT = '#db2777';

export interface SignInLinkEmailParams {
  customerName: string | null;
  /** Absolute /account/verify?token=… URL. */
  signInUrl: string;
}

export interface SignInLinkEmailContent {
  subject: string;
  html: string;
}

export function buildSignInLinkEmail(params: SignInLinkEmailParams): SignInLinkEmailContent {
  const { customerName, signInUrl } = params;

  const greeting = customerName?.trim() ? `Hello ${escapeHtml(customerName.trim())},` : 'Hello,';
  const subject = sanitizeHeader('Your sign-in link for GidiamMini');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${ACCENT}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .box { background: white; padding: 24px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${ACCENT}; text-align: center; }
        .cta { display: inline-block; background: ${ACCENT}; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Sign in to your orders</h1>
        <p>${greeting}</p>
      </div>
      <div class="content">
        <p>Tap the button to see your order history, saved delivery details and reorder anything you have bought before. No password needed.</p>

        <div class="box">
          <a href="${escapeHtml(signInUrl)}" class="cta">Sign in</a>
          <p style="margin: 12px 0 0; color: #6b7280; font-size: 13px;">
            This link works once and expires in 20 minutes.
          </p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          If the button does not work, copy this into your browser:<br>
          <span style="word-break: break-all;">${escapeHtml(signInUrl)}</span>
        </p>

        <p style="color: #6b7280; font-size: 14px;">
          <strong>Did not ask for this?</strong> Somebody typed your email or phone
          number into our sign-in box. Ignore this email and nothing happens — the
          link is useless unless it is opened, and it stops working shortly anyway.
        </p>

        <div class="footer">
          <p>You received this because a sign-in was requested for this address. It is not a subscription.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
