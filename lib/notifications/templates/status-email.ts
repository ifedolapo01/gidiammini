// lib/notifications/templates/status-email.ts
// HTML builder for order status-update emails, plus the color/icon/next-steps
// helpers used purely for this email's presentation (hex colors + emoji —
// email HTML can't use Tailwind tokens or lucide-react JSX icons, so these
// stay distinct from lib/commerce/order-status.ts's web-UI versions). The
// status LIST/labels still come from lib/commerce/order-status.ts so the two
// never drift out of sync on which statuses exist.
import { formatOrderStatus } from '@/lib/commerce/order-status';
import { buildTrackOrderButton } from './track-order-cta';

export interface StatusEmailParams {
  orderNumber: string;
  customerName: string;
  newStatus: string;
  customMessage?: string;
  /** Real, order-specific delivery/pickup timing text — only used for 'confirmed'. */
  estimatedDeliveryText?: string;
}

export interface StatusEmailContent {
  subject: string;
  html: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: 'Your order has been confirmed and is being processed.',
  rescheduled: 'Your delivery timing has changed — see below for details.',
  shipped: 'Your order has been shipped! Track your package for delivery updates.',
  ready_for_pickup: 'Your order is ready for pickup!',
  picked_up: 'Your order has been picked up. Thank you for shopping with us!',
  delivered: 'Your order has been delivered. Thank you for shopping with us!',
  cancelled: 'Your order has been cancelled. Contact us if you have any questions.'
};

const STATUS_EMOJI: Record<string, string> = {
  confirmed: '✅',
  rescheduled: '🗓️',
  shipped: '🚚',
  ready_for_pickup: '🏬',
  picked_up: '📦',
  delivered: '📦',
  cancelled: '❌'
};

export function getStatusColor(status: string): string {
  switch (status) {
    case 'confirmed': return '#3b82f6'; // blue
    case 'rescheduled': return '#b45309'; // amber
    case 'shipped': return '#8b5cf6'; // purple
    case 'ready_for_pickup': return '#f59e0b'; // orange
    case 'picked_up': return '#10b981'; // green
    case 'delivered': return '#10b981'; // green
    case 'cancelled': return '#ef4444'; // red
    default: return '#6b7280'; // gray
  }
}

export function getStatusIcon(status: string): string {
  return STATUS_EMOJI[status] || '📋';
}

export function getNextSteps(status: string, estimatedDeliveryText?: string): string {
  switch (status) {
    case 'confirmed':
      return `
        <li>We'll prepare your order</li>
        <li>You'll receive another update as it progresses</li>
        <li>${estimatedDeliveryText || "We'll share your estimated timeline shortly"}</li>
      `;
    case 'rescheduled':
      return `
        <li>Your new delivery timing will be confirmed shortly</li>
        <li>Contact us if you'd like to discuss the new schedule</li>
      `;
    case 'shipped':
      return `
        <li>Track your package using the tracking link provided</li>
        <li>Be available to receive your delivery</li>
        <li>Contact us if there are any delivery issues</li>
      `;
    case 'ready_for_pickup':
      return `
        <li>Come by with your order number to collect your items</li>
        <li>Contact us if you need to arrange a different pickup time</li>
      `;
    case 'picked_up':
      return `
        <li>Check your items after pickup</li>
        <li>Contact us within 24 hours if there are any issues</li>
        <li>Share your experience with a review</li>
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
  const { orderNumber, customerName, newStatus, customMessage, estimatedDeliveryText } = params;

  const statusLabel = formatOrderStatus(newStatus);
  const message = STATUS_MESSAGES[newStatus] || `Your order status has been updated to: ${statusLabel}`;
  const subject = STATUS_MESSAGES[newStatus]
    ? `${getStatusIcon(newStatus)} Order ${statusLabel} - #${orderNumber}`
    : `Order Status Update - #${orderNumber}`;

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
            ${statusLabel}
          </div>
          <h2>Order #${orderNumber}</h2>
        </div>

        <div class="message-box">
          <h3>${subject}</h3>
          <p>${message}</p>

          ${customMessage ? `
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <h4>📝 Additional Message:</h4>
              <p>${customMessage}</p>
            </div>
          ` : ''}
        </div>

        <p><strong>What's Next?</strong></p>
        <ul>
          ${getNextSteps(newStatus, estimatedDeliveryText)}
        </ul>

        ${buildTrackOrderButton(getStatusColor(newStatus))}

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

  return { subject, html };
}
