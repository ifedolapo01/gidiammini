// app/api/admin/customers/campaign/route.ts - one message to one segment.
//
// The subscriber broadcast already exists (/api/admin/discounts/notify) and
// can only address everybody. This addresses a tag, which is the whole point
// of having tags: "everyone who has ever bought wholesale" is a message worth
// sending and a message that should not go to the other four hundred people.
//
// DRY RUN BY DEFAULT
//
// Without `confirm: true` this reports the recipient count and sends nothing.
// An email to a segment cannot be recalled, the segment is defined by a tag
// somebody typed, and the failure mode — a typo matching a far larger group
// than intended — is invisible until it has already happened. So the count is
// shown first and the send is a second, deliberate action.
//
// BLOCKED BUYERS ARE EXCLUDED
//
// Somebody blocked is somebody the shop has decided not to trade with.
// Marketing to them is at best absurd and at worst an argument.
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { customerCampaignSchema } from '@/lib/api/schemas/admin-customers';
import { buildSegmentEmail } from '@/lib/notifications/templates/segment-email';
import { sendBulkEmail } from '@/lib/email';

/** A segment message can take a while to hand to the mail server. */
export const maxDuration = 300;

/**
 * A ceiling on one send.
 *
 * Not a paging limit — a segment past this is not a segment, and quietly
 * mailing the first 500 of a larger group would be worse than refusing. The
 * response says so rather than truncating.
 */
const MAX_RECIPIENTS = 500;

async function recipientsFor(
  supabase: SupabaseClient<Database>,
  tag: string
): Promise<{ emails: string[]; total: number }> {
  const { data, error, count } = await supabase
    .from('customers')
    .select('email', { count: 'exact' })
    .contains('tags', [tag])
    .eq('is_blocked', false)
    .limit(MAX_RECIPIENTS + 1);

  if (error) throw error;

  return {
    emails: (data ?? []).map((row) => (row as { email: string }).email).filter(Boolean),
    total: count ?? 0,
  };
}

export const POST = withAdminAuth(async (request, { supabase, audit }) => {
  const parsed = await parseJsonBody(request, customerCampaignSchema);
  if (!parsed.ok) return parsed.response;

  const { tag, subject, message, confirm } = parsed.data;

  let recipients: { emails: string[]; total: number };
  try {
    recipients = await recipientsFor(supabase, tag);
  } catch (error: any) {
    console.error('Segment lookup failed:', error?.message);
    return NextResponse.json(
      { success: false, error: 'Could not work out who is in that segment.' },
      { status: 500 }
    );
  }

  if (recipients.total === 0) {
    return NextResponse.json(
      { success: false, error: `Nobody is tagged "${tag}".`, recipients: 0 },
      { status: 400 }
    );
  }

  if (recipients.total > MAX_RECIPIENTS) {
    return NextResponse.json(
      {
        success: false,
        error: `"${tag}" matches ${recipients.total} people, which is more than one send may address (${MAX_RECIPIENTS}). Narrow the segment.`,
        recipients: recipients.total,
      },
      { status: 400 }
    );
  }

  // The dry run. Deliberately a 200 with sent: false rather than an error —
  // nothing went wrong, this is the answer to "who would get this".
  if (!confirm) {
    return NextResponse.json({
      success: true,
      sent: false,
      recipients: recipients.total,
      message: `${recipients.total} customer${recipients.total === 1 ? '' : 's'} tagged "${tag}" would receive this.`,
    });
  }

  const { subject: safeSubject, html } = buildSegmentEmail({ subject, message });
  const result = await sendBulkEmail(recipients.emails, safeSubject, html);

  // Recorded whether or not it worked: a send that failed half way is exactly
  // the thing somebody asks about the next morning, and the entry is the only
  // record that the attempt happened at all.
  audit({
    entityType: 'customer',
    entityId: null,
    action: 'notify',
    after: {
      segment: tag,
      recipients: recipients.total,
      subject: safeSubject,
      delivered: result.success,
    },
    reason: `Segment message to "${tag}"`,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.detail, reason: result.reason, recipients: recipients.total },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    sent: true,
    recipients: recipients.total,
    message: `Sent to ${recipients.total} customer${recipients.total === 1 ? '' : 's'} tagged "${tag}".`,
  });
});
