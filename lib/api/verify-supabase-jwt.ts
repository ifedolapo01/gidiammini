/**
 * Verifying a Supabase access token without asking Supabase.
 *
 * getUser() is the correct way to authenticate a request — it validates the
 * token at the auth server rather than trusting the cookie. It is also a
 * network round-trip, and the admin makes one API call every few seconds just
 * to check whether anything changed.
 *
 * Checking the signature locally against the project's own JWT secret proves
 * exactly the same thing: only Supabase can produce a token that verifies.
 * This is the fast path; anything it cannot decide falls back to getUser().
 *
 * Deliberately conservative. It answers 'unsupported' rather than 'invalid'
 * whenever it is out of its depth — no secret configured, or a token signed
 * with something other than HS256, which is what a project migrated to
 * asymmetric signing keys issues. Guessing 'invalid' there would lock every
 * admin out the day the project's key type changes.
 */

export type TokenCheck =
  | { status: 'valid'; sub: string }
  | { status: 'invalid' }
  | { status: 'unsupported' };

/** Returns an ArrayBuffer rather than a view: crypto.subtle's BufferSource
 * will not accept a Uint8Array whose backing buffer TypeScript cannot prove is
 * a plain ArrayBuffer. */
function base64urlToBytes(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

function decodeJson(segment: string): any | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64urlToBytes(segment)));
  } catch {
    return null;
  }
}

export async function verifySupabaseAccessToken(token: string): Promise<TokenCheck> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return { status: 'unsupported' };

  const parts = token.split('.');
  if (parts.length !== 3) return { status: 'invalid' };

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const header = decodeJson(encodedHeader);
  if (!header) return { status: 'invalid' };
  // Asymmetric signing keys, or anything else this cannot check itself.
  if (header.alg !== 'HS256') return { status: 'unsupported' };

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signed = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlToBytes(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );

    if (!signed) return { status: 'invalid' };
  } catch (error) {
    console.error('Local access-token verification failed to run:', error);
    return { status: 'unsupported' };
  }

  const payload = decodeJson(encodedPayload);
  if (!payload) return { status: 'invalid' };

  // `exp` is seconds since the epoch here — the standard, unlike the custom
  // token this replaced, which stored milliseconds.
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) return { status: 'invalid' };

  // A service-role or anon key is also a signed JWT from this project. Neither
  // is a signed-in person, and neither may pass for one.
  if (payload.role !== 'authenticated') return { status: 'invalid' };

  if (typeof payload.sub !== 'string' || !payload.sub) return { status: 'invalid' };

  return { status: 'valid', sub: payload.sub };
}
