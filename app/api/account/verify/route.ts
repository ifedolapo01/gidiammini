// app/api/account/verify/route.ts - exchanging the emailed link for a session.
//
// A POST, deliberately, even though the customer arrives by clicking a link.
// The link lands on /account/verify, which asks them to press a button, and
// that button posts here — because mail providers and security scanners
// prefetch links, and a single-use token fetched by a scanner is a token the
// customer finds already spent.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import { parseJsonBody } from '@/lib/api/parse-body';
import { signInVerifySchema } from '@/lib/api/schemas/account';
import { redeemSignInLink } from '@/lib/commerce/customer-auth';
import { setSessionCookie } from '@/lib/api/customer-session';

async function verifyLink(request: NextRequest) {
  const parsed = await parseJsonBody(request, signInVerifySchema);
  if (!parsed.ok) return parsed.response;

  const outcome = await redeemSignInLink(createAdminClient(), parsed.data.token);

  if (!outcome.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          outcome.reason === 'expired'
            ? 'That link has expired. Ask for a new one — it only takes a moment.'
            : 'That link is not valid. It may already have been used.',
      },
      { status: outcome.reason === 'expired' ? 410 : 401 }
    );
  }

  const response = NextResponse.json({
    success: true,
    customer: { email: outcome.customer.email, fullName: outcome.customer.fullName },
  });

  setSessionCookie(response, outcome.sessionToken);
  return response;
}

export const POST = withRateLimit(
  RATE_LIMITS.signInVerify,
  verifyLink,
  'Too many attempts. Please wait a few minutes and try again.'
);
