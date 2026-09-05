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
   * Search. Typeahead fires as the visitor types, so this has to be generous —
   * a debounced input still sends a request every few keystrokes, and a
   * browsing session can easily run several searches. Costs one indexed read
   * and one small insert, so the ceiling is about stopping a scraper walking
   * the catalogue rather than about protecting anything expensive.
   */
  search: { bucket: 'search', limit: 120, windowSeconds: 5 * MINUTE },

  /**
   * Product listing. Every facet change is a request, and a shopper ticking
   * through sizes and colours generates them in bursts, so this is deliberately
   * loose. It exists to stop a scraper paging the whole catalogue in a loop,
   * not to ration browsing.
   */
  browse: { bucket: 'browse', limit: 180, windowSeconds: 5 * MINUTE },

  /**
   * "Email me when it's back". Writes an email address to a table, so it is
   * held to roughly the newsletter's budget — a shopper might legitimately ask
   * about several sold-out products in one visit, but not thirty.
   */
  stockAlert: { bucket: 'stock-alert', limit: 10, windowSeconds: HOUR },

  /**
   * Writing a review. Only an invite holder can, and the unique index allows
   * one review per product per order — so this is not the spam gate, it is a
   * ceiling on how fast someone with a valid link can hammer the endpoint. A
   * three-item order legitimately produces three submits in a couple of
   * minutes, plus a retry or two.
   */
  reviewSubmit: { bucket: 'review-submit', limit: 15, windowSeconds: HOUR },

  /**
   * Review photos. Writes an object to storage, like the receipt upload, and
   * one review may carry four — so a family posting three reviews with photos
   * is a genuine dozen uploads.
   */
  reviewPhoto: { bucket: 'review-photo', limit: 20, windowSeconds: HOUR },

  /**
   * Asking a product question. The only unauthenticated write here with no
   * purchase behind it, so it is held to the contact form's budget rather than
   * the review flow's: a shopper comparing three products might genuinely ask
   * about each, and nothing they submit is visible until an admin answers it.
   */
  askQuestion: { bucket: 'ask-question', limit: 5, windowSeconds: HOUR },

  /**
   * Asking for a customer sign-in link. Sends mail, and it is the one endpoint
   * where somebody could probe whether an address shops here — so it gets the
   * contact form's budget. A real customer asks once, maybe twice if the first
   * mail is slow.
   *
   * Deliberately NOT failClosed, despite being an auth endpoint. There is no
   * password here to grind: the credential is a 43-character random token, so
   * the threat is mail spam rather than guessing, and that is the same threat
   * the contact form accepts. Failing closed would mean a limiter outage locks
   * every customer out of their own order history — a worse outage than the one
   * it would be protecting against.
   */
  signInRequest: { bucket: 'signin-request', limit: 5, windowSeconds: HOUR },

  /**
   * Redeeming a sign-in link. A separate budget because the customer has
   * already proved control of the inbox by getting here; this only caps how
   * fast somebody can throw guessed tokens at the endpoint, which is already
   * hopeless against 32 bytes of entropy.
   */
  signInVerify: { bucket: 'signin-verify', limit: 20, windowSeconds: 15 * MINUTE },

  /**
   * Reorder. One indexed read plus a product lookup, and it only ever answers
   * a signed-in session about its own orders.
   */
  reorder: { bucket: 'reorder', limit: 30, windowSeconds: HOUR },

  /**
   * Recording an abandoned cart. Called as somebody types their email at
   * checkout, debounced, so a genuine shopper produces a handful per visit and
   * a determined one a few dozen. The row is keyed on the address, so the
   * table grows with distinct customers rather than with requests — what this
   * caps is the write rate, not the size.
   */
  cartCapture: { bucket: 'cart-capture', limit: 60, windowSeconds: HOUR },

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

  /**
   * Redeeming an admin invitation. The token is Supabase's own, so guessing it
   * is not the threat; this caps how fast somebody can throw attempts at the
   * endpoint that turns a token into an admin session. Fails closed for the
   * same reason the login rules do — an invitation can wait for the database.
   */
  adminInviteAccept: { bucket: 'admin-invite-accept', limit: 10, windowSeconds: 15 * MINUTE, failClosed: true },
} satisfies Record<string, RateLimitRule>;
