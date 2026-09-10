/** ADMIN layer — the fetch every admin data call goes through.
 *
 * Replaces a global `window.fetch` patch. The patch worked, and was well
 * reasoned: rather than duplicate "if 401, log out and redirect" across the
 * sixty-odd call sites in the admin section (and risk forgetting it in the next
 * one), it wrapped fetch once for the lifetime of the admin shell.
 *
 * What it could not do is limit itself to our calls. It saw every request on
 * the page — Vercel Analytics, anything Next issues, anything a future
 * dependency issues — and it depended on being the last thing to touch
 * `window.fetch`: another patch layered over it, or any module that captured a
 * reference to fetch before the effect ran, quietly changed the behaviour. That
 * is the kind of coupling that works until it does not, and then takes a long
 * time to explain.
 *
 * This is the same behaviour with none of the reach: an explicit function, so
 * only the calls that opt in are inspected.
 *
 * A 401 from any admin endpoint means the session itself is invalid — see
 * lib/api/admin-session.ts, where every admin route's auth lives — so it is
 * always safe to treat one as "please log in again". The two endpoints where a
 * 401 means something else simply do not use this function: /api/admin/login
 * (wrong password) and /api/admin/accept-invite (no session yet, by design).
 */

/**
 * Set by useAdminSessionGuard, which owns the router and the toast. Kept as a
 * module-level handler rather than a hook argument so adminFetch stays a plain
 * function callable from hooks, event handlers and non-React helpers alike.
 */
let onSessionExpired: (() => void) | null = null;

/** Registered once by the admin shell. Returns nothing — the caller unsets it
 *  on unmount by calling this with null. */
export function setAdminSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

/**
 * The same "please log in again" handling adminFetch triggers on a 401 —
 * exposed for the handful of admin write paths that cannot go through
 * adminFetch because they are not an HTTP fetch at all (a Next.js Server
 * Action, e.g. app/actions/upload.ts). Those still check the session
 * themselves and can return an "unauthorized" result; calling this is how
 * that result gets the same toast, cookie clear and redirect a 401 from a
 * real fetch would, instead of surfacing as inert error text with nobody
 * actually logged out.
 */
export function notifyAdminSessionExpired(): void {
  onSessionExpired?.();
}

/**
 * `fetch`, plus "a 401 means the session is gone".
 *
 * Deliberately the same signature as fetch, so a call site changes by name
 * only and nothing has to learn a new shape.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401) onSessionExpired?.();

  // Returned either way. The handler redirects, but the caller's own error
  // path still runs in the meantime, and a hook that swallowed the response
  // here would render a loading state forever if the redirect were ever slow.
  return response;
}
