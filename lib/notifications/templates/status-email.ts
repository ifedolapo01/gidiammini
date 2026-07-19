// lib/notifications/templates/status-email.ts
// HTML builder for order status-update emails, plus the color/icon/next-steps
// helpers used purely for this email's presentation (hex colors + emoji).
// Distinct from any Admin UI status-badge helper that may live in
// lib/commerce/order-status.ts - these are for different mediums, do not merge.

export interface StatusEmailParams {
  orderNumber: string;
  customerName: string;
  newStatus: string;
  customMessage?: string;
}

export interface StatusEmailContent {
  subject: string;
  html: string;
}

const STATUS_MESSAGES: Record<string, { subject: string; message: string }> = {
  confirmed: {
    subject: '',
    message: `Your order has been confirmed and is being processed.`
  },
  shipped: {
    subject: '',
    message: `Your order has been shipped! Track your package for delivery updates.`
  },
  delivered: {
    subject: '',
    message: `Your order has been delivered. Thank you for shopping with us!`
  },
  cancelled: {
    subject: '',
    message: `Your order has been cancelled. Contact us if you have any questions.`
  }
};

export function getStatusColor(status: string): string {
  switch (status) {
    case 'confirmed': return '#3b82f6'; // blue
    case 'shipped': return '#8b5cf6'; // purple
    case 'delivered': return '#10b981'; // green
    case 'cancelled': return '#ef4444'; // red
    default: return '#6b7280'; // gray
  }
}

export function getStatusIcon(status: string): string {
  switch (status) {
    case 'confirmed': return '✅';
    case 'shipped': return '🚚';
    case 'delivered': return '📦';
    case 'cancelled': return '❌';
    default: return '📋';
  }
}

export function getNextSteps(status: string): string {
  switch (status) {
    case 'confirmed':
      return `
        <li>We'll prepare your items for shipping</li>
        <li>You'll receive another update when your order ships</li>
        <li>Estimated delivery: 3-5 business days</li>
      `;
    case 'shipped':
      return `
        <li>Track your package using the tracking link provided</li>
        <li>Be available to receive your delivery</li>
        <li>Contact us if there are any delivery issues</li>
      `;
    case 'delivered':
      return `
        <li>Check your items upon delivery</li>
        <li>Contact us within 24 hours if there are any issues</li>
        <li>Share your experience with a review</li>
      `;
    case 'cancelled':
      return `
        <li>Contact us if you have questions about the cancellation</li>
        <li>Refunds (if applicable) will be processed within 5-7 business days</li>
        <li>Browse our store for other items you might like</li>
      `;
    default:
      return `
        <li>We'll keep you updated on your order progress</li>
        <li>Contact us if you have any questions</li>
      `;
  }
}

export function buildStatusEmail(params: StatusEmailParams): StatusEmailContent {
  const { orderNumber, customerName, newStatus, customMessage } = params;

  const statusMessages: Record<string, { subject: string; message: string }> = {
    confirmed: {
      subject: `✅ Order Confirmed - #${orderNumber}`,
      message: STATUS_MESSAGES.confirmed.message
    },
    shipped: {
      subject: `🚚 Order Shipped - #${orderNumber}`,
      message: STATUS_MESSAGES.shipped.message
    },
    delivered: {
      subject: `📦 Order Delivered - #${orderNumber}`,
      message: STATUS_MESSAGES.delivered.message
    },
    cancelled: {
      subject: `❌ Order Cancelled - #${orderNumber}`,
      message: STATUS_MESSAGES.cancelled.message
    }
  };

  const statusInfo = statusMessages[newStatus] || {
    subject: `Order Status Update - #${orderNumber}`,
    message: `Your order status has been updated to: ${newStatus}`
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${getStatusColor(newStatus)}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .status-badge { display: inline-block; padding: 8px 16px; background: white; color: ${getStatusColor(newStatus)}; border-radius: 20px; font-weight: bold; margin: 10px 0; }
        .message-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${getStatusColor(newStatus)}; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${getStatusIcon(newStatus)} Order Status Update</h1>
        <p>Hello ${customerName},</p>
      </div>
      <div class="content">
        <div style="text-align: center;">
          <div class="status-badge">
            ${newStatus.toUpperCase()}
          </div>
          <h2>Order #${orderNumber}</h2>
        </div>

        <div class="message-box">
          <h3>${statusInfo.subject}</h3>
          <p>${statusInfo.message}</p>

          ${customMessage ? `
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <h4>📝 Additional Message:</h4>
              <p>${customMessage}</p>
            </div>
          ` : ''}
        </div>

        <p><strong>What's Next?</strong></p>
        <ul>
          ${getNextSteps(newStatus)}
        </ul>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Need Help?</strong></p>
          <p>📞 Call us: 0809 653 9067</p>
          <p>✉️ Email: support@gidiammini.com</p>
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

  return { subject: statusInfo.subject, html };
}
