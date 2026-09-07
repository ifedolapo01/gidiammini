// lib/notifications/templates/email-shell.ts
// The frame every customer email has always had — the same <style> block, the
// same coloured header, the same contact card, the same footer — written once.
//
// Each template up to now carried its own copy of that markup, differing only
// in one hex value and one title. That is nine places to edit a phone number
// and nine chances for one of them to be missed. New templates build on this;
// the existing ones are left alone deliberately, since rewriting a working
// email's markup risks its rendering for no functional gain.
import { escapeHtml } from '@/lib/notifications/escape-html';

/** Where a customer reaches a person. One definition, every email. */
export const SHOP_CONTACT = {
  phone: '0809 653 9067',
  email: 'support@gidiammini.com',
  whatsapp: '+234 809 653 9067',
  name: 'GidiamMini',
  address: 'Abuja, Nigeria',
} as const;

export interface EmailShellParams {
  /** Header colour, and the colour of any CTA inside the body. */
  accentColor: string;
  /** The header line, emoji included. Escaped. */
  heading: string;
  /** Greeting under the heading, usually the customer's name. Escaped. */
  greeting?: string;
  /** Body markup. Built by the caller and inserted verbatim, so everything
   *  interpolated into it must already be escaped. */
  body: string;
  /** Heading of the contact card. Omit it to leave the card out. */
  contactPrompt?: string | null;
}

/** The contact card, on its own so a template can place it mid-body. */
export function buildContactCard(prompt: string): string {
  return `
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>${escapeHtml(prompt)}</strong></p>
          <p>📞 Call us: ${SHOP_CONTACT.phone}</p>
          <p>✉️ Email: ${SHOP_CONTACT.email}</p>
          <p>💬 WhatsApp: ${SHOP_CONTACT.whatsapp}</p>
        </div>`;
}

// Inline-style building blocks shared by every template that used to reach
// for the shell's <style> block classes (.header/.content/.panel/.figures/
// .footer). Mail clients — Gmail among them — strip or ignore a <style>
// block in <head>, which made every one of those classes render as plain
// unstyled text. There is no selector-based fix for HTML email: each rule
// has to land as a `style="…"` attribute on the actual element, so these
// exist once here instead of every caller retyping the same CSS text.
export const BODY_STYLE =
  'font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;';

export function headerStyle(accentColor: string): string {
  return `background: ${accentColor}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;`;
}

export const CONTENT_STYLE = 'background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;';

export function panelStyle(accentColor: string): string {
  return `background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${accentColor};`;
}

export const FIGURES_TABLE_STYLE = 'width: 100%; border-collapse: collapse; margin: 8px 0;';

export const FIGURES_TD_STYLE = 'padding: 8px 0; border-bottom: 1px solid #e5e7eb;';

/**
 * `.figures td:last-child { text-align: right; font-weight: bold; }` has no
 * inline-style equivalent — there is no ":last-child" attribute — so this
 * must be applied directly to whichever `<td>` is actually last in each row.
 * `extra` carries any per-row override that used to sit in that td's own
 * `style="…"` (e.g. an accent colour), appended last so it still wins over
 * the bold/right-align defaults exactly as the old cascade did.
 */
export function figuresLastTdStyle(extra?: string): string {
  return `${FIGURES_TD_STYLE} text-align: right; font-weight: bold;${extra ? ` ${extra}` : ''}`;
}

export const FOOTER_STYLE = 'text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;';

export function buildEmailShell(params: EmailShellParams): string {
  const { accentColor, heading, greeting, body, contactPrompt } = params;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="${BODY_STYLE}">
      <div style="${headerStyle(accentColor)}">
        <h1>${escapeHtml(heading)}</h1>
        ${greeting ? `<p>Hello ${escapeHtml(greeting)},</p>` : ''}
      </div>
      <div style="${CONTENT_STYLE}">
        ${body}
        ${contactPrompt ? buildContactCard(contactPrompt) : ''}
        <p>Best regards,<br>
        <strong>The ${SHOP_CONTACT.name} Team</strong></p>
      </div>
      <div style="${FOOTER_STYLE}">
        <p>${SHOP_CONTACT.name} Clothing Store<br>
        ${SHOP_CONTACT.address}</p>
      </div>
    </body>
    </html>
  `;
}
