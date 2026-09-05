// lib/supabase/realtime-client.ts — the admin browser's realtime connection.
//
// A fifth factory, and the only client that runs in an admin browser. It is
// deliberately NOT ./client: that one is the storefront's anon client, and
// mixing the two would mean a storefront page could inherit an admin token.
//
// The session lives in httpOnly cookies the browser cannot read (see
// admin-auth-server.ts), so instead of `supabase.auth`, this client is built
// with an `accessToken` callback. supabase-js calls it whenever it needs a
// token — including when the socket reconnects — and it fetches a short-lived
// access token from /api/admin/realtime-token, caching it in memory until
// shortly before it expires. Nothing is written to localStorage or a cookie,
// so a token dies with the tab.
//
// A failure here is not fatal by design: the caller falls back to the change-
// cursor poll it already had, so an expired token, a dropped socket or realtime
// being unavailable degrades to slower updates rather than a stale screen.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/** Refresh this long before the token actually expires, so an in-flight
 * reconnect never presents one that dies mid-handshake. */
const RENEW_MARGIN_SECONDS = 60;

let cached: { token: string; expiresAt: number } | null = null;
let inFlight: Promise<string> | null = null;
let client: SupabaseClient<Database> | null = null;

async function requestToken(): Promise<string> {
  const response = await fetch('/api/admin/realtime-token');
  if (!response.ok) throw new Error(`Realtime token request failed (${response.status})`);

  const result = await response.json();
  if (!result?.success || !result.token) throw new Error(result?.error || 'No realtime token');

  cached = {
    token: result.token,
    // A missing expiry is treated as "expired now", so the next call fetches
    // again rather than pinning a token of unknown age forever.
    expiresAt: typeof result.expiresAt === 'number' ? result.expiresAt : 0,
  };

  return cached.token;
}

async function currentToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - RENEW_MARGIN_SECONDS > now) return cached.token;

  // Several channels subscribing at once must not each fetch their own.
  if (!inFlight) {
    inFlight = requestToken().finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}

/** The shared admin realtime client. One per tab — a second connection would
 * just be a second socket carrying the same events. */
export function getAdminRealtimeClient(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase environment variables are not set');

  client = createClient<Database>(url, anonKey, {
    // `accessToken` replaces the client's own auth entirely — supabase-js
    // throws on any supabase.auth.* call once it is set, which is exactly the
    // guarantee wanted here: this client cannot start a session of its own,
    // and cannot persist one anywhere a script could read it back.
    accessToken: currentToken,
    realtime: { params: { eventsPerSecond: 2 } },
  });

  return client;
}

/** Drops the cached token — call after signing out so a new session cannot
 * reuse the previous admin's socket credentials. */
export function clearAdminRealtimeToken(): void {
  cached = null;
}
