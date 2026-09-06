/**
 * What a notification was for. Pure.
 *
 * One list, because notifications.kind is the column every timeline groups by
 * and every "why did they get three of these" question filters on. A free
 * string per call site would give the same message two names within a month.
 *
 * The database constrains the *shape* only (lowercase, underscores) rather
 * than the values, so adding a template is a change here and not a migration.
 */

export const NOTIFICATION_KINDS = [
  'order_received',
  'status_change',
  'order_amended',
  'payment_reminder',
  'payment_shortfall',
  'payment_rejected',
  'refund',
  'review_invite',
  'back_in_stock',
  'wishlist_alert',
  'abandoned_cart',
  'question_answered',
  'sign_in_link',
  'admin_invite',
  /** A one-off written by an admin on the order screen. */
  'custom',
  /** A campaign to a segment of customers. */
  'segment',
  /** A sale announcement to newsletter subscribers. The only kind that
   *  carries an unsubscribe link, and the only one that must. */
  'marketing',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** How a kind reads in the order timeline. */
export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  order_received: 'Order confirmation',
  status_change: 'Status update',
  order_amended: 'Order amended',
  payment_reminder: 'Payment reminder',
  payment_shortfall: 'Payment short',
  payment_rejected: 'Payment rejected',
  refund: 'Refund',
  review_invite: 'Review invite',
  back_in_stock: 'Back in stock',
  wishlist_alert: 'Wishlist alert',
  abandoned_cart: 'Abandoned cart',
  question_answered: 'Question answered',
  sign_in_link: 'Sign-in link',
  admin_invite: 'Admin invite',
  custom: 'Message from the shop',
  segment: 'Campaign',
  marketing: 'Sale announcement',
};

/**
 * Kinds an admin may re-send from the order screen.
 *
 * Short, for a reason worth stating plainly: the notifications table records
 * that a message was sent and to whom, not what it said. Storing every
 * rendered body would double the size of the table and duplicate the customer
 * data already on the order, so a resend does not replay the old message — it
 * builds a fresh one from the order as it stands now.
 *
 * That makes only two kinds honestly resendable:
 *
 *   order_received   the confirmation, which is a function of the order.
 *   status_change    the current status, which is a function of the order.
 *
 * Everything else is excluded because rebuilding it would produce a different
 * message under the same name. A 'custom' message was free text nobody kept; a
 * payment reminder refers to a balance that has since moved; a refund notice
 * quotes an amount. Re-sending any of those would mean inventing content and
 * labelling it a resend. An admin who needs one of those sends a new custom
 * message, which the timeline records as exactly that.
 *
 * A sign-in link and an admin invite are excluded more firmly still: both mint
 * a credential, and a button labelled "Resend" is not where that should happen.
 */
export const RESENDABLE_KINDS: NotificationKind[] = ['order_received', 'status_change'];

export function isResendable(kind: string): kind is NotificationKind {
  return RESENDABLE_KINDS.includes(kind as NotificationKind);
}

export function kindLabel(kind: string): string {
  return NOTIFICATION_KIND_LABELS[kind as NotificationKind] ?? kind.replace(/_/g, ' ');
}
