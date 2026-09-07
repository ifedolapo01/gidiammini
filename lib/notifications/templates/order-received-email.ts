// lib/notifications/templates/order-received-email.ts
// HTML builder for the immediate "we got your order" email sent right after
// checkout — before any admin action, so the customer has their order number
// and a tracking link even while payment is still being verified.
import { buildTrackOrderButton } from './track-order-cta';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';

export interface OrderReceivedEmailParams {
  orderNumber: string;
  customerName: string;
  /** Formatted delivery window ("Tue 12 – Thu 14 Sept"). Omitted for pickup,
   *  an unresolved zone, or an order placed before this field existed. */
  deliveryEstimate?: string | null;
}

export interface OrderReceivedEmailContent {
  subject: string;
  html: string;
}

export function buildOrderReceivedEmail(params: OrderReceivedEmailParams): OrderReceivedEmailContent {
  const { orderNumber, customerName, deliveryEstimate } = params;
  const subject = sanitizeHeader(`Order received: #${orderNumber}`);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1>✅ Order Received!</h1>
        <p>Hello ${escapeHtml(customerName)},</p>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
        <p>Thanks for your order. We've received your payment receipt and we're verifying it now. We'll email/SMS you as soon as it's confirmed.</p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px dashed #2563eb; text-align: center;">
          <p style="margin: 0 0 4px; color: #6b7280;">Your order number</p>
          <p style="font-size: 24px; font-weight: bold; color: #2563eb; letter-spacing: 1px;">#${escapeHtml(orderNumber)}</p>
          <p style="margin: 8px 0 0; color: #6b7280; font-size: 13px;">Save this. You'll need it (with the email or phone number you checked out with) to track your order.</p>
        </div>

        ${deliveryEstimate ? `
        <p style="text-align: center; margin: 0 0 20px; color: #374151;">
          Estimated delivery: <strong>${escapeHtml(deliveryEstimate)}</strong>
        </p>` : ''}

        ${buildTrackOrderButton('#2563eb')}

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 24px 0;">
          <p><strong>Questions about your order?</strong></p>
          <p>📞 Call us: 0809 653 9067</p>
          <p>✉️ Email: support@gidiammini.com</p>
          <p>💬 WhatsApp: +234 809 653 9067</p>
        </div>

        <p>Best regards,<br>
        <strong>The GidiamMini Team</strong></p>
      </div>
      <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
        <p>GidiamMini Clothing Store<br>
        Abuja, Nigeria</p>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
