/**
 * Taking a dead address off the marketing list, automatically.
 *
 * subscribers.unsubscribe_source has allowed 'bounce' since migration
 * 20260906140000, alongside 'link' and 'admin' — reserved for exactly this,
 * and unset by anything until now. A hard bounce means the receiving server
 * has refused the address outright; mailing it again only costs sending
 * reputation for a message nobody will ever get.
 *
 * BEST-EFFORT, ALWAYS — same rule as lib/notifications/log.ts. Called from a
 * provider webhook that must still answer 200 for the notification-status
 * update that matters more, so a failure here is logged and swallowed rather
 * than turned into a retry.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin-server';

/**
 * Marks the active subscriber at this address as unsubscribed.
 *
 * Matched byte-for-byte, not case-folded: `email` is `event.data.to` from the
 * bounce webhook, which is the address exactly as the send handed it to
 * Resend — and that came straight from this same subscribers.email column
 * with no transformation in between (lib/api/schemas/common.ts's emailField
 * does not lowercase). Folding case here would risk the opposite of a
 * mismatch: matching a different subscriber who happens to share a
 * differently-cased address.
 */
export async function suppressBouncedAddress(email: string): Promise<void> {
  const address = email.trim();
  if (!address) return;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('subscribers')
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString(),
        unsubscribe_source: 'bounce',
      })
      .eq('email', address)
      .eq('is_active', true);

    if (error) throw error;
  } catch (error) {
    console.error(`Could not suppress bounced address ${address}:`, error);
  }
}
