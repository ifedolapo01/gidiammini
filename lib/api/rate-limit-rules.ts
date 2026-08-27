/**
 * The rate limits for every public endpoint, in one place so they can be
 * reviewed as a set rather than hunted for across route files.
 *
 * Each number is chosen against how a real customer behaves, with headroom for
 * a shared connection (a household, an office, a mobile carrier NAT can all
 * present one IP), and then against what abusing the endpoint actually costs:
 * an email send, a storage object, or just a database read.
 */
import type { RateLimitRule } from './rate-limit';

const MINUTE = 60;
const HOUR = 60 * MINUTE;

export const RATE_LIMITS = {
  /**
   * Order creation. A customer places one order per checkout; 5/hour leaves
   * room for a genuine retry after a failure while capping how fast anyone can
   * manufacture orders (each one claims stock and sends an email).
   */
  createOrder: { bucket: 'order-create', limit: 5, windowSeconds: HOUR },

  /**
   * Checkout re-pricing. Called on every step-1 submit, and a customer may
   * legitimately go back and change their address several times.
   */
  checkoutQuote: { bucket: 'checkout-quote', limit: 40, windowSeconds: 10 * MINUTE },

  /**
   * Receipt upload. Writes an object to storage, so this is the endpoint that
   * can fill a quota. A customer uploads one file, maybe retrying a couple of
   * times if the first photo was unreadable.
   */
  receiptUpload: { bucket: 'receipt-upload', limit: 10, windowSeconds: HOUR },

  /**
   * Order tracking. The important one: order number + email/phone is a
   * guessable pair, and order numbers are "UT" plus a truncated timestamp.
   * Without a limit this endpoint is an oracle you can grind. 20/10min is
   * generous for someone checking their own order and useless for enumeration.
   */
  orderTrack: { bucket: 'order-track', limit: 20, windowSeconds: 10 * MINUTE },

  /**
   * Change requests. Emails the store owner, and the code already refuses a
   * second request while one is pending.
   */
  changeRequest: { bucket: 'change-request', limit: 10, windowSeconds: HOUR },

  /** Contact form. Sends mail on your quota from your domain. */
  contact: { bucket: 'contact', limit: 3, windowSeconds: HOUR },

  /** Newsletter signup. Also sends a welcome email. */
  subscribe: { bucket: 'subscribe', limit: 5, windowSeconds: HOUR },

  /**
   * Admin login, per IP. Fails closed: an unthrottled password guesser against
   * a single shared credential is worse than a login page that is unavailable
   * while the database is down — and with the database down the admin cannot
   * do anything anyway.
   */
  loginPerIp: { bucket: 'login-ip', limit: 10, windowSeconds: 15 * MINUTE, failClosed: true },

  /**
   * Admin login, per account. A second key so rotating IPs doesn't multiply the
   * attempt budget. Only *failed* attempts consume it, and a success clears it,
   * so a legitimate admin who mistypes a few times isn't punished.
   */
  loginPerAccount: { bucket: 'login-account', limit: 8, windowSeconds: 15 * MINUTE, failClosed: true },
} satisfies Record<string, RateLimitRule>;
