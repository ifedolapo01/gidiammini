// lib/email-streams.ts - which stream a message belongs to, and the sender it
// goes out as.
//
// Order confirmations and discount blasts are different products sharing one
// mail account. A promotional complaint hurts the reputation of whatever
// address it was sent from, so if that address is also the one carrying
// "your order has shipped", a marketing complaint can put order confirmations
// in spam. Splitting the sender is what keeps the two reputations apart.
//
// This is the code-level half: every send is labelled and addressed by stream,
// so the streams are already separable. Completing it is a DNS job — point
// RESEND_MARKETING_FROM_EMAIL at a subdomain (mail.yourstore.com) verified
// separately in Resend, and the reputations are genuinely independent. Until
// then both fall back to one address and behave exactly as before.

/** Mail the customer asked for by acting, vs. mail the shop chose to send. */
export type EmailStream = 'transactional' | 'marketing';

/** The display name on every message, whatever the stream. */
const SENDER_NAME = 'GidiamMini Store';

const firstSet = (...values: (string | undefined)[]): string | undefined =>
  values.map((value) => value?.trim()).find((value) => Boolean(value));

/**
 * The bare address a stream sends from, before the display name is attached.
 *
 * Falls back through the SMTP variables so a store that has not set
 * RESEND_FROM_EMAIL yet keeps sending from the address it always did — the
 * transport can change without the sender changing under the customer.
 */
export function senderAddress(stream: EmailStream): string | undefined {
  if (stream === 'marketing') {
    return firstSet(
      process.env.RESEND_MARKETING_FROM_EMAIL,
      process.env.RESEND_FROM_EMAIL,
      process.env.EMAIL_FROM,
      process.env.EMAIL_USER
    );
  }

  return firstSet(process.env.RESEND_FROM_EMAIL, process.env.EMAIL_FROM, process.env.EMAIL_USER);
}

/** The From header, e.g. `"GidiamMini Store" <noreply@shop.com>`. */
export function senderFor(stream: EmailStream): string | undefined {
  const address = senderAddress(stream);
  return address ? `"${SENDER_NAME}" <${address}>` : undefined;
}

/**
 * Resend tags, so the dashboard can report on the two streams separately.
 *
 * Tag values are restricted to ASCII letters, digits, underscores and dashes,
 * which both stream names already satisfy.
 */
export function tagsFor(stream: EmailStream): { name: string; value: string }[] {
  return [{ name: 'stream', value: stream }];
}
