// app/api/account/login/route.ts - asking for a sign-in link.
//
// The one endpoint in this feature that an unauthenticated stranger can reach,
// so it is built to answer nothing. Whether the contact matched a customer,
// matched several, matched a blocked one, or matched nobody, the response is
// the same shape — because a different answer per case turns this into a way
// to ask "does this person shop here", about a shop selling baby clothes.
//
// The only variation is the masked address, and only when a mail actually went
// out: the UI words both cases identically, so the masked value is a
// convenience for the person who really does own the inbox rather than a
// signal to somebody guessing.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { isBotSubmission } from '@/lib/api/schemas/common';
import { signInRequestSchema } from '@/lib/api/schemas/account';
import { parseContact } from '@/lib/commerce/customer-account';
import { requestSignInLink } from '@/lib/commerce/customer-auth';

/** Said whatever happened. "If" is doing the work in that sentence. */
const SENT = {
  success: true,
  message: 'If that matches an order, we have emailed you a sign-in link. It works once and lasts 20 minutes.',
};

async function requestLink(request: NextRequest) {
  const parsed = await parseJsonBody(request, signInRequestSchema);
  if (!parsed.ok) return parsed.response;

  if (isBotSubmission(parsed.data)) {
    console.warn('Sign-in honeypot triggered — discarding silently.');
    return NextResponse.json(SENT);
  }

  const contact = parseContact(parsed.data.contact);

  // Unparseable input is the one thing worth saying plainly: it is a typo, not
  // a privacy boundary, and "we sent a link" to something that is neither an
  // email nor a phone number would leave them waiting for nothing.
  if (!contact) {
    return NextResponse.json(
      { success: false, error: 'Enter the email address or phone number you used at checkout.' },
      { status: 400 }
    );
  }

  const outcome = await requestSignInLink(createAdminClient(), contact);

  return NextResponse.json({ ...SENT, sentTo: outcome.sentTo });
}

export const POST = withRateLimit(
  RATE_LIMITS.signInRequest,
  requestLink,
  'Too many sign-in requests. Please wait a while and try again.'
);
