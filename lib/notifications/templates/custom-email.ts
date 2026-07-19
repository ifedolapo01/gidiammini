// lib/notifications/templates/custom-email.ts
// HTML builder for ad-hoc "message about your order" emails sent by admins.

export interface CustomEmailParams {
  orderNumber: string;
  customerName: string;
  message: string;
}

export interface CustomEmailContent {
  subject: string;
  html: string;
}

export function buildCustomEmail(params: CustomEmailParams): CustomEmailContent {
  const { orderNumber, customerName, message } = params;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .message-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📨 Message About Your Order</h1>
        <p>Hello ${customerName},</p>
      </div>
      <div class="content">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2>Order #${orderNumber}</h2>
          <p>You have a new message from our team:</p>
        </div>

        <div class="message-box">
          <p style="font-style: italic; color: #4b5563;">"${message}"</p>
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Need to respond?</strong></p>
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

  return { subject: `Message About Your Order #${orderNumber}`, html };
}
