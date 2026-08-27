// app/api/admin/login/route.ts
//
// Throttled on two independent keys, because there is exactly one admin
// credential in this deployment and it is the whole of the admin's security:
//
//   * per IP      — the usual flood control
//   * per account — so rotating through IPs (trivial and cheap) doesn't
//                   multiply the number of guesses available
//
// Only FAILED attempts consume the per-account budget, and a success clears it,
// so an admin who mistypes their password a few times and then gets it right
// isn't left carrying those failures for the rest of the window.
//
// Both rules fail closed: if the rate limiter itself can't run, the login is
// refused. An unthrottled password guesser does real damage, and with the
// database down the admin can't do anything useful anyway.
import { NextRequest, NextResponse } from 'next/server';
import { signJWT } from '@/lib/auth';
import bcryptjs from 'bcryptjs';
import {
  checkRateLimit, resetRateLimit, rateLimitKey, clientIdentifier, tooManyRequests,
} from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';

const THROTTLED_MESSAGE = 'Too many sign-in attempts. Please wait 15 minutes and try again.';
/** Deliberately identical for a wrong email and a wrong password, so the
 * response can't be used to discover which admin address is valid. */
const INVALID_MESSAGE = 'Invalid credentials';

/** Normalised so 'Admin@X.com' and 'admin@x.com' share one attempt budget. */
function accountKey(email: unknown): string {
  const normalised = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return rateLimitKey(RATE_LIMITS.loginPerAccount.bucket, normalised || 'unknown');
}

export async function POST(request: NextRequest) {
  try {
    const ipKey = rateLimitKey(RATE_LIMITS.loginPerIp.bucket, clientIdentifier(request));

    // Counted on every attempt, successful or not.
    const byIp = await checkRateLimit(ipKey, RATE_LIMITS.loginPerIp);
    if (!byIp.allowed) {
      console.warn(`Login throttled by IP: ${clientIdentifier(request)}`);
      return tooManyRequests(byIp, THROTTLED_MESSAGE);
    }

    const { email, password } = await request.json();
    const accountLimitKey = accountKey(email);

    // Read the per-account budget without consuming it — failures below are
    // what spend it, so a legitimate admin's successful logins are free.
    const byAccount = await checkRateLimit(accountLimitKey, RATE_LIMITS.loginPerAccount, { count: false });
    if (!byAccount.allowed) {
      console.warn('Login throttled by account (too many recent failures)');
      return tooManyRequests(byAccount, THROTTLED_MESSAGE);
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    const jwtSecret = process.env.JWT_SECRET;

    if (!adminEmail || !adminPasswordHash || !jwtSecret) {
      console.error('Admin configuration missing in environment variables');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // bcrypt.compare is run even when the email is wrong, so the response time
    // doesn't reveal whether the address matched.
    const isPasswordValid = await bcryptjs.compare(String(password ?? ''), adminPasswordHash);

    if (email !== adminEmail || !isPasswordValid) {
      // Only now spend a slot from the per-account budget.
      await checkRateLimit(accountLimitKey, RATE_LIMITS.loginPerAccount);
      return NextResponse.json({ success: false, error: INVALID_MESSAGE }, { status: 401 });
    }

    // Success: forget the earlier fumbles.
    await resetRateLimit(accountLimitKey);

    const token = await signJWT(
      {
        role: 'admin',
        email,
        exp: Date.now() + 60 * 60 * 24 * 7 * 1000, // 7 days
      },
      jwtSecret
    );

    const response = NextResponse.json({ success: true, message: 'Login successful' });

    response.cookies.set('admin-token', token, {
      httpOnly: true,
      secure: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
