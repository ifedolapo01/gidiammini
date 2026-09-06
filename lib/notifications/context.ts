/**
 * What ties a notification to the thing it was about. Pure.
 *
 * A leaf module: index.ts orchestrates and order-emails.ts sends, and both
 * need to name this shape. Putting it in either would make the other import
 * it and close a circle.
 */

/** What a notification needs to be findable on an order's timeline later.
 *  Optional throughout: a message can be worth sending before the order row
 *  exists, and a log entry with no order attached is still a log entry. */
export interface NotificationContext {
  orderId?: string | null;
  customerId?: string | null;
  /** The admin who caused it, where one did. */
  actorId?: string | null;
  /** The notification this repeats. */
  resendOf?: string | null;
}
