// lib/notifications/templates/tracking-block.ts
// The courier and waybill panel that turns "your order has shipped" into
// something the customer can act on.
//
// Its own module rather than more markup inside status-email.ts, because that
// file is already at its size limit and because the same two questions — who
// has it, what is the number — are asked by the shipped email, the packing
// slip and the tracking page. One definition of how they are phrased.
//
// The panel renders nothing at all when there is nothing to say. A "Tracking"
// heading over an empty box is worse than no heading: it reads as information
// that failed to load.
import { carrierName } from '@/lib/commerce/order-tracking';
import type { OrderTracking } from '@/lib/commerce/order-tracking';
import { escapeHtml } from '@/lib/notifications/escape-html';

/** The courier/waybill card, or '' when the order has no tracking. */
export function buildTrackingPanel(
  tracking: Partial<OrderTracking> | null | undefined,
  accentColor: string
): string {
  if (!tracking) return '';

  const name = carrierName(tracking.carrier);
  const number = tracking.trackingNumber;
  const url = tracking.trackingUrl;

  if (!name && !number && !url) return '';

  return `
        <div class="panel" style="border-left-color: ${accentColor};">
          <p><strong>📦 Your parcel</strong></p>
          <table class="figures">
            ${name ? `<tr><td>Courier</td><td>${escapeHtml(name)}</td></tr>` : ''}
            ${number ? `<tr><td>Tracking number</td><td style="font-family: monospace;">${escapeHtml(number)}</td></tr>` : ''}
          </table>
          ${url
            ? `<div style="text-align: center; margin-top: 16px;">
            <a href="${escapeHtml(url)}" style="display: inline-block; background-color: ${accentColor}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Track with ${escapeHtml(name || 'the courier')}</a>
          </div>`
            : ''}
        </div>`;
}

/**
 * The "what's next" bullets for a shipped order.
 *
 * Replaces the generic "track your package using the tracking link provided"
 * — a sentence that promised a link the email did not contain, which is
 * precisely why every delivery produced a follow-up message.
 */
export function trackingNextSteps(tracking: Partial<OrderTracking> | null | undefined): string | null {
  const name = carrierName(tracking?.carrier);
  const number = tracking?.trackingNumber;

  if (!name && !number) return null;

  const who = name ? `<li>${escapeHtml(name)} has your parcel${number ? ` — reference <strong>${escapeHtml(number)}</strong>` : ''}</li>` : '';
  const how = tracking?.trackingUrl
    ? '<li>Use the tracking button above for the latest position</li>'
    : number
      ? `<li>Quote that reference if you contact the courier directly</li>`
      : '';

  return `
        ${who}
        ${how}
        <li>Be available on the phone number you gave us so the rider can reach you</li>
      `;
}

/** One short line for an SMS. Empty when there is nothing worth the characters. */
export function trackingSmsLine(tracking: Partial<OrderTracking> | null | undefined): string {
  const name = carrierName(tracking?.carrier);
  const number = tracking?.trackingNumber;

  if (name && number) return `${name} waybill: ${number}`;
  if (number) return `Waybill: ${number}`;
  if (name) return `Sent with ${name}.`;
  return '';
}
