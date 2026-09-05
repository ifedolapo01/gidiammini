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

export function buildEmailShell(params: EmailShellParams): string {
  const { accentColor, heading, greeting, body, contactPrompt } = params;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${accentColor}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .panel { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${accentColor}; }
        .figures { width: 100%; border-collapse: collapse; margin: 8px 0; }
        .figures td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .figures td:last-child { text-align: right; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(heading)}</h1>
        ${greeting ? `<p>Hello ${escapeHtml(greeting)},</p>` : ''}
      </div>
      <div class="content">
        ${body}
        ${contactPrompt ? buildContactCard(contactPrompt) : ''}
        <p>Best regards,<br>
        <strong>The ${SHOP_CONTACT.name} Team</strong></p>
      </div>
      <div class="footer">
        <p>${SHOP_CONTACT.name} Clothing Store<br>
        ${SHOP_CONTACT.address}</p>
      </div>
    </body>
    </html>
  `;
}
