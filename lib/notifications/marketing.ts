/**
 * Sending to the newsletter list. Server only.
 *
 * WHY THIS IS ONE MESSAGE PER SUBSCRIBER
 *
 * The discount cron used to BCC the entire list in a single send. That is
 * cheaper and it makes a lawful unsubscribe impossible: one message body
 * cannot carry a link that identifies which of four thousand recipients
 * clicked it, so the footer can only ever say "reply to opt out" — which
 * nobody honours and no regulator accepts. Bulk marketing without a working
 * one-click opt-out is a problem under the NDPR and its equivalents, not a
 * missing nicety.
 *
 * So each subscriber gets their own message, with their own token in the
 * footer and in a List-Unsubscribe header. That is N sends instead of one; on
 * a list this size, against a shop that already sends an email per order, it
 * is not the bottleneck. `PAUSE_EVERY` keeps a consumer SMTP relay from
 * treating the run as a burst.
 *
 * REFUSES TO SEND WITHOUT A WORKING LINK
 *
 * If no secret is configured the tokens cannot be signed, so the footer would
 * be a dead link. This sends nothing at all in that case rather than mailing
 * the list without a way off it — the failure mode of a broken unsubscribe is
 * legal, and it is not improved by more mail going out.
 */
import 'server-only';
import { sendOrderEmail } from '@/lib/email';
import { absoluteUrl } from '@/lib/site-url';
import { recordNotification } from './log';
import { canSignUnsubscribeLinks, unsubscribeToken } from './unsubscribe-token';

export interface MarketingRecipient {
  id: string;
  email: string;
  name?: string | null;
}

export interface MarketingSendResult {
  sent: number;
  failed: number;
  /** Set when nothing was attempted, with the reason. */
  refused?: string;
}

/** Messages between short pauses, and how long to pause. Gmail's SMTP starts
 *  deferring well before a few hundred in a row. */
const PAUSE_EVERY = 25;
const PAUSE_MS = 1000;

export function unsubscribeUrl(subscriberId: string): string | null {
  const token = unsubscribeToken(subscriberId);
  if (!token) return null;
  return absoluteUrl(`/unsubscribe?id=${encodeURIComponent(subscriberId)}&t=${encodeURIComponent(token)}`);
}

/**
 * The footer every marketing message carries.
 *
 * Plain and unmissable rather than 8px grey text: an unsubscribe link that has
 * to be hunted for produces spam complaints instead of unsubscribes, and a
 * complaint costs the shop's ability to reach everybody else.
 */
export function unsubscribeFooter(url: string): string {
  return `
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px;" />
    <p style="color: #6b7280; font-size: 12px; text-align: center; line-height: 1.6;">
      You are receiving this because you signed up for offers from our store.<br />
      <a href="${url}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
      &mdash; one click, no sign-in needed.
    </p>
  `;
}

/**
 * Sends one campaign to one list.
 *
 * `buildHtml` receives the footer already rendered, so a template cannot
 * forget it — the alternative is a `footer` argument that a new template
 * silently omits, which is the exact failure this function exists to prevent.
 */
export async function sendMarketingCampaign(params: {
  recipients: MarketingRecipient[];
  subject: string;
  buildHtml: (context: { recipient: MarketingRecipient; unsubscribeFooterHtml: string }) => string;
  kind?: 'marketing' | 'segment';
}): Promise<MarketingSendResult> {
  const { recipients, subject, buildHtml, kind = 'marketing' } = params;

  if (!canSignUnsubscribeLinks()) {
    console.error(
      'Refusing to send a campaign: neither UNSUBSCRIBE_SECRET nor SUPABASE_JWT_SECRET is set, ' +
      'so the unsubscribe link cannot be signed.'
    );
    return { sent: 0, failed: 0, refused: 'No unsubscribe secret is configured.' };
  }

  let sent = 0;
  let failed = 0;

  for (const [index, recipient] of recipients.entries()) {
    const url = unsubscribeUrl(recipient.id);
    if (!url) {
      failed++;
      continue;
    }

    const html = buildHtml({ recipient, unsubscribeFooterHtml: unsubscribeFooter(url) });
    const result = await sendOrderEmail(recipient.email, subject, html);

    await recordNotification({
      channel: 'email',
      kind,
      recipient: recipient.email,
      subject,
      status: result.success ? ((result.rejected?.length ?? 0) > 0 ? 'bounced' : 'sent') : 'failed',
      providerMessageId: result.success ? (result.messageId ?? null) : null,
      failureReason: result.success ? null : result.reason,
      failureDetail: result.success ? null : result.detail,
    });

    if (result.success) sent++;
    else failed++;

    // A pause between batches, not between messages: the cost of the sleep is
    // paid once per 25 rather than 4,000 times.
    if ((index + 1) % PAUSE_EVERY === 0 && index + 1 < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
  }

  return { sent, failed };
}
