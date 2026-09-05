// lib/notifications/templates/status-email.ts
// HTML builder for order status-update emails. The wording, colours and
// "What's Next" bullets live in status-email-copy.ts; this file is only the
// assembly.
//
// It predates buildEmailShell() and keeps its own <style> block on purpose —
// see the note in email-shell.ts about not rewriting a working email's markup
// for no functional gain. The .panel and .figures rules below are the shell's,
// copied so buildTrackingPanel() renders identically here.
import type { OrderTracking } from '@/lib/commerce/order-tracking';
import { buildTrackOrderButton } from './track-order-cta';
import { buildTrackingPanel } from './tracking-block';
import {
  STATUS_MESSAGES, formatOrderStatus, getStatusColor, getStatusIcon, getNextSteps,
} from './status-email-copy';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';

// Re-exported: these were part of this module's surface before the copy split,
// and moving them silently would be a needless break for anything importing
// them.
export { getStatusColor, getStatusIcon, getNextSteps } from './status-email-copy';

export interface StatusEmailParams {
  orderNumber: string;
  customerName: string;
  newStatus: string;
  customMessage?: string;
  /** Real, order-specific delivery/pickup timing text — only used for 'confirmed'. */
  estimatedDeliveryText?: string;
  /** Courier and waybill, once the order has them. Only rendered for
   * 'shipped': a tracking panel on a cancellation is noise. */
  tracking?: Partial<OrderTracking> | null;
}

export interface StatusEmailContent {
  subject: string;
  html: string;
}

export function buildStatusEmail(params: StatusEmailParams): StatusEmailContent {
  const { orderNumber, customerName, newStatus, customMessage, estimatedDeliveryText, tracking } = params;
  const trackingPanel = newStatus === 'shipped' ? buildTrackingPanel(tracking, getStatusColor(newStatus)) : '';

  const statusLabel = formatOrderStatus(newStatus);
  const message = STATUS_MESSAGES[newStatus] || `Your order status has been updated to: ${statusLabel}`;
  const subject = STATUS_MESSAGES[newStatus]
    ? sanitizeHeader(`${getStatusIcon(newStatus)} Order ${statusLabel} - #${orderNumber}`)
    : sanitizeHeader(`Order Status Update - #${orderNumber}`);

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
        .panel { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${getStatusColor(newStatus)}; }
        .figures { width: 100%; border-collapse: collapse; margin: 8px 0; }
        .figures td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .figures td:last-child { text-align: right; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${getStatusIcon(newStatus)} Order Status Update</h1>
        <p>Hello ${escapeHtml(customerName)},</p>
      </div>
      <div class="content">
        <div style="text-align: center;">
          <div class="status-badge">
            ${statusLabel}
          </div>
          <h2>Order #${escapeHtml(orderNumber)}</h2>
        </div>

        <div class="message-box">
          <h3>${subject}</h3>
          <p>${message}</p>

          ${customMessage ? `
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <h4>📝 Additional Message:</h4>
              <p>${escapeHtmlWithBreaks(customMessage)}</p>
            </div>
          ` : ''}
        </div>

        ${trackingPanel}

        <p><strong>What's Next?</strong></p>
        <ul>
          ${getNextSteps(newStatus, estimatedDeliveryText, tracking)}
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
