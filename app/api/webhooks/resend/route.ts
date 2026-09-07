// app/api/webhooks/resend/route.ts - the provider telling us what happened
// after a message was accepted.
//
// Nothing in lib/email-resend.ts can see past the moment Resend accepts a
// send: 'delivered', 'bounced' and 'complained' were reserved statuses on
// notifications.status with nothing that could ever set them (migration
// 20260906140000). This is the thing that sets them.
//
// Same three rules as app/api/webhooks/paystack/route.ts:
//
//   1. The signature is checked against the RAW body — parsing first would
//      change the bytes the HMAC covers.
//   2. Nothing in the payload is trusted before verification. Resend's own
//      SDK does the checking (lib/notifications/resend-webhook.ts holds only
//      what happens after it passes).
//   3. It answers 200 to anything it has understood, including event types it
//      deliberately ignores — a provider that gets a non-200 retries, and
//      retrying an event we do not act on is noise forever.
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { markNotificationStatus } from '@/lib/notifications/log';
import { notificationUpdateFor, bouncedRecipients } from '@/lib/notifications/resend-webhook';
import { suppressBouncedAddress } from '@/lib/notifications/subscriber-suppress';

/**
 * Verification checks only the payload against the webhook secret — it never
 * calls the Resend API — but the SDK's constructor still demands a non-empty
 * key up front regardless, or throws before webhooks.verify() is ever
 * reached. The placeholder satisfies that requirement without depending on
 * RESEND_API_KEY (the sending credential) being set: a deployment that only
 * receives events, or is mid-migration off SMTP, must not lose bounce
 * reporting for that reason.
 */
function verifier() {
  return new Resend(process.env.RESEND_API_KEY || 'unused-verify-only-key').webhooks;
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Nothing is configured, so nothing can be verified. 503 rather than 200:
    // this is a state worth retrying into once the secret is set, not a
    // permanent no.
    return NextResponse.json({ success: false }, { status: 503 });
  }

  const raw = await request.text();

  const id = request.headers.get('webhook-id');
  const timestamp = request.headers.get('webhook-timestamp');
  const signature = request.headers.get('webhook-signature');

  let event;
  try {
    // Throws on a missing header, a stale timestamp, or a signature that does
    // not match — the checks are indistinguishable from here, and all three
    // mean the same thing: this did not come from Resend. See rule 1: `raw`
    // is what gets signed, so it is what must be verified, before anything
    // touches JSON.parse.
    event = verifier().verify({
      payload: raw,
      headers: { id: id ?? '', timestamp: timestamp ?? '', signature: signature ?? '' },
      webhookSecret: secret,
    });
  } catch (error) {
    console.warn('Rejected a Resend webhook with a bad signature:', error);
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const update = notificationUpdateFor(event);
  if (!update) {
    // Understood and ignored. See rule 3.
    return NextResponse.json({ success: true, ignored: event.type });
  }

  await markNotificationStatus(update.providerMessageId, update.status, update.detail);

  // A dead address costs sending reputation on every future marketing send
  // and this is the one place that ever learns an address is dead — done
  // after the notification row, which is the record a support conversation is
  // settled from, so a failure here cannot cost that write. See the header of
  // suppressBouncedAddress for why a complaint does not also do this.
  await Promise.all(bouncedRecipients(event).map(suppressBouncedAddress));

  return NextResponse.json({ success: true, status: update.status });
}
