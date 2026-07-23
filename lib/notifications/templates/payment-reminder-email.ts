// lib/notifications/templates/payment-reminder-email.ts
// HTML builder for the "we're still verifying your payment" nudge sent when
// an order has sat in 'pending' a while. By the time an order exists at all,
// the customer has already uploaded a receipt (checkout requires one before
// the order is created) — so this must never imply they haven't paid; it's
// reassurance that verification is still in progress on our end.
import { formatCurrency } from '@/lib/commerce/pricing';

export interface PaymentReminderEmailParams {
  orderNumber: string;
  customerName: string;
  totalAmount: number;
}

export interface PaymentReminderEmailContent {
  subject: string;
  html: string;
}

export function buildPaymentReminderEmail(params: PaymentReminderEmailParams): PaymentReminderEmailContent {
  const { orderNumber, customerName, totalAmount } = params;

  const subject = `Still verifying your payment for order #${orderNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #b45309; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .message-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #b45309; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>⏳ Still Verifying Your Payment</h1>
        <p>Hello ${customerName},</p>
      </div>
      <div class="content">
        <div style="text-align: center;">
          <h2>Order #${orderNumber}</h2>
        </div>

        <div class="message-box">
          <p>We received your payment receipt for order #${orderNumber} (<strong>${formatCurrency(totalAmount)}</strong>), and it's taking us a little longer than usual to verify it against our bank records.</p>
          <p>There's nothing further you need to do — we'll email/SMS you the moment it's confirmed. If you'd like an update in the meantime, feel free to reach out.</p>
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Questions about your order?</strong></p>
          <p>📞 Call us: 0809 653 9067</p>
          <p>✉️ Email: support@gidiammini.com</p>
          <p>💬 WhatsApp: +234 809 653 9067</p>
        </div>

        <p>Best regards,<br>
        <strong>The GidiamMini Team</strong></p>
      </div>
      <div class="footer">
        <p>GidiamMini Clothing Store<br>
        Abuja, Nigeria</p>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
