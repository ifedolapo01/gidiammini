// lib/notifications/templates/track-order-cta.ts
// Shared "Track Your Order" button + URL for every customer-facing email
// template, so the link/copy/markup can't drift between templates and every
// email gives the customer a one-click way to check their order.

export const TRACK_ORDER_URL = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://gidiammini.com'}/track-order`;

/** `accentColor` matches each email's own theme color (its header/CTA hex) so the button never clashes. */
export function buildTrackOrderButton(accentColor: string): string {
  return `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${TRACK_ORDER_URL}" style="display: inline-block; background-color: ${accentColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Track Your Order</a>
        </div>`;
}
