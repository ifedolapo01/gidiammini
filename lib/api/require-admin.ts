/**
 * Admin auth for Server Actions.
 *
 * lib/auth.ts's verifyAdminAuth() takes a NextRequest, which Server Actions
 * don't have — they read the request through next/headers instead. That gap is
 * why app/actions/upload.ts shipped with no auth check at all: a Server Action
 * is a POST endpoint that anyone who can load the page can invoke, so an
 * unchecked one using the service-role key is effectively public.
 *
 * Kept in its own module rather than added to lib/auth.ts because that file is
 * imported by middleware.ts, which runs on the edge runtime and must not pull
 * in next/headers.
 */
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';

/** True when the caller presents a valid admin session cookie. */
export async function isAdminRequest(): Promise<boolean> {
  const token = (await cookies()).get('admin-token')?.value;
  if (!token) return false;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not defined — refusing to treat the caller as an admin.');
    return false;
  }

  const payload = await verifyJWT(token, secret);
  return payload !== null && payload.role === 'admin';
}
