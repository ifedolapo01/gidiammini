// app/api/account/logout/route.ts - signing this device out.
//
// Deletes the session row as well as clearing the cookie. Clearing the cookie
// alone would leave a working credential in whatever copied it; deleting the
// row is what makes it inert everywhere, which is the reason sessions are rows
// and not self-contained tokens.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { endSession } from '@/lib/commerce/customer-auth';
import { clearSessionCookie, sessionTokenFrom } from '@/lib/api/customer-session';

export async function POST(request: NextRequest) {
  await endSession(createAdminClient(), sessionTokenFrom(request));

  // Success either way: a browser with no session is already signed out, and
  // saying so as an error would be answering a question nobody asked.
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
