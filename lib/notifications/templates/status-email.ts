// lib/notifications/templates/status-email.ts
// HTML builder for order status-update emails. The wording, colours and
// "What's Next" bullets live in status-email-copy.ts; this file is only the
// assembly.
//
// It predates buildEmailShell() and keeps its own assembly on purpose — see
// the note in email-shell.ts about not rewriting a working email's markup for
// no functional gain. It reuses the shell's inline-style helpers (panelStyle
// et al.) so buildTrackingPanel() — which uses the same helpers — renders
// identically here.
import type { OrderTracking } from '@/lib/commerce/order-tracking';
import { buildTrackOrderButton } from './track-order-cta';
import { buildTrackingPanel } from './tracking-block';
import {
  STATUS_MESSAGES, formatOrderStatus, getStatusColor, getStatusIcon, getNextSteps,
} from './status-email-copy';
import { escapeHtml, escapeHtmlWithBreaks, sanitizeHeader } from '@/lib/notifications/escape-html';
import { BODY_STYLE, headerStyle, CONTENT_STYLE, panelStyle, FOOTER_STYLE } from './email-shell';

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

  const statusColor = getStatusColor(newStatus);
  const statusBadgeStyle =
    `display: inline-block; padding: 8px 16px; background: white; color: ${statusColor}; border-radius: 20px; font-weight: bold; margin: 10px 0;`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="${BODY_STYLE}">
      <div style="${headerStyle(statusColor)}">
        <h1>${getStatusIcon(newStatus)} Order Status Update</h1>
        <p>Hello ${escapeHtml(customerName)},</p>
      </div>
      <div style="${CONTENT_STYLE}">
        <div style="text-align: center;">
          <div style="${statusBadgeStyle}">
            ${statusLabel}
          </div>
          <h2>Order #${escapeHtml(orderNumber)}</h2>
        </div>

        <div style="${panelStyle(statusColor)}">
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

        ${buildTrackOrderButton(statusColor)}

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Need Help?</strong></p>
          <p>📞 Call us: 0809 653 9067</p>
          <p>✉️ Email: support@gidiammini.com</p>
        </div>

        <p>Best regards,<br>
        <strong>The GidiamMini Team</strong></p>
      </div>
      <div style="${FOOTER_STYLE}">
        <p>GidiamMini Clothing Store<br>
        Abuja, Nigeria</p>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
