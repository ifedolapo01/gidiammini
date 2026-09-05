/**
 * The fast path in front of every admin request.
 *
 * What matters here is not that a good token passes — it is that the three
 * "cannot decide" cases answer 'unsupported' rather than 'invalid'. Getting
 * that backwards locks every admin out the day the project's signing keys
 * change, and getting it backwards the other way lets an unverified token
 * through.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifySupabaseAccessToken } from './verify-supabase-jwt';

const SECRET = 'a-test-jwt-secret-of-reasonable-length';

const b64url = (value: string) =>
  Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

async function sign(payload: Record<string, unknown>, secret = SECRET, alg = 'HS256') {
  const header = b64url(JSON.stringify({ alg, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  const encoded = Buffer.from(new Uint8Array(signature))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${header}.${body}.${encoded}`;
}

const future = () => Math.floor(Date.now() / 1000) + 3600;
const past = () => Math.floor(Date.now() / 1000) - 10;

const validPayload = () => ({ sub: 'user-uuid', role: 'authenticated', exp: future() });

beforeEach(() => {
  vi.stubEnv('SUPABASE_JWT_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('verifySupabaseAccessToken', () => {
  it('accepts a live token this project signed', async () => {
    await expect(verifySupabaseAccessToken(await sign(validPayload()))).resolves.toEqual({
      status: 'valid',
      sub: 'user-uuid',
    });
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = await sign(validPayload(), 'not-the-projects-secret');
    await expect(verifySupabaseAccessToken(forged)).resolves.toEqual({ status: 'invalid' });
  });

  it('rejects an expired token', async () => {
    const stale = await sign({ ...validPayload(), exp: past() });
    await expect(verifySupabaseAccessToken(stale)).resolves.toEqual({ status: 'invalid' });
  });

  it('rejects a token with no expiry at all', async () => {
    const forever = await sign({ sub: 'user-uuid', role: 'authenticated' });
    await expect(verifySupabaseAccessToken(forever)).resolves.toEqual({ status: 'invalid' });
  });

  it('rejects the service-role and anon keys, which this project also signed', async () => {
    // Both are valid JWTs bearing this signature. Neither is a signed-in
    // person, and treating one as an admin would turn a published anon key
    // into an admin session.
    for (const role of ['service_role', 'anon']) {
      const key = await sign({ role, exp: future(), sub: 'irrelevant' });
      await expect(verifySupabaseAccessToken(key)).resolves.toEqual({ status: 'invalid' });
    }
  });

  it('rejects a token carrying no subject', async () => {
    const anonymous = await sign({ role: 'authenticated', exp: future() });
    await expect(verifySupabaseAccessToken(anonymous)).resolves.toEqual({ status: 'invalid' });
  });

  it('rejects a malformed token', async () => {
    await expect(verifySupabaseAccessToken('not.a.jwt')).resolves.toEqual({ status: 'invalid' });
    await expect(verifySupabaseAccessToken('nonsense')).resolves.toEqual({ status: 'invalid' });
  });

  it('defers rather than refuses when no secret is configured', async () => {
    vi.stubEnv('SUPABASE_JWT_SECRET', '');
    await expect(verifySupabaseAccessToken(await sign(validPayload()))).resolves.toEqual({
      status: 'unsupported',
    });
  });

  it('defers rather than refuses on an asymmetrically signed token', async () => {
    // What a project migrated to ECC/RSA signing keys issues. Answering
    // 'invalid' here would lock out every admin the day that happens; the
    // caller falls back to getUser() instead.
    const asymmetric = await sign(validPayload(), SECRET, 'ES256');
    await expect(verifySupabaseAccessToken(asymmetric)).resolves.toEqual({ status: 'unsupported' });
  });
});
