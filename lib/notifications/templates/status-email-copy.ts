// lib/notifications/templates/status-email-copy.ts
// What each order status says to a customer, and how it looks doing it.
//
// Split from status-email.ts, which is now only the assembly of the message.
// These are editorial decisions — the sentence for 'shipped', the colour for
// 'cancelled', the bullets under "What's Next" — and they change for reasons
// that have nothing to do with the email's structure. Keeping them apart means
// rewording a status does not mean opening the file that builds the HTML.
//
// The hex colours and emoji are deliberately not the ones in
// lib/commerce/order-status.ts: email HTML cannot use Tailwind tokens or
// lucide-react JSX. The status LIST and labels still come from there, so the
// two can never disagree about which statuses exist.
import { formatOrderStatus } from '@/lib/commerce/order-status';
import type { OrderTracking } from '@/lib/commerce/order-tracking';
import { trackingNextSteps } from './tracking-block';
import { escapeHtml } from '@/lib/notifications/escape-html';

/** Re-exported so status-email.ts has one import for its copy. */
export { formatOrderStatus };

/** The one sentence each status leads with, and the test for whether a status
 * has bespoke copy at all — buildStatusEmail falls back to a generic subject
 * for anything not listed here. */
export const STATUS_MESSAGES: Record<string, string> = {
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

export function getNextSteps(
  status: string,
  estimatedDeliveryText?: string,
  tracking?: Partial<OrderTracking> | null
): string {
  switch (status) {
    case 'confirmed':
      return `
        <li>We'll prepare your order</li>
        <li>You'll receive another update as it progresses</li>
        <li>${escapeHtml(estimatedDeliveryText) || "We'll share your estimated timeline shortly"}</li>
      `;
    case 'rescheduled':
      return `
        <li>Your new delivery timing will be confirmed shortly</li>
        <li>Contact us if you'd like to discuss the new schedule</li>
      `;
    case 'shipped':
      // The generic version promised "the tracking link provided" and provided
      // none, which is what made every delivery generate a follow-up message.
      // With a courier on the order the steps name it; without one they no
      // longer pretend.
      return trackingNextSteps(tracking) ?? `
        <li>We will call you before the parcel arrives</li>
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
