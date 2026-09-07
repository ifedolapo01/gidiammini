/**
 * The admin endpoints that must work without an admin session, because getting
 * one is what they are for.
 *
 * A leaf module so the two things that must agree about it cannot drift: the
 * middleware, which lets these through, and
 * lib/api/admin-route-coverage.test.ts, which fails the build if a route is
 * unguarded and not listed here. A new endpoint becomes public only by being
 * added in one deliberate place.
 */
export const PUBLIC_ADMIN_API_PATHS = new Set([
  // The credential exchange itself.
  '/api/admin/login',
  // An expired or already-invalid session must still be able to log out —
  // answering 401 would leave stale cookies in the browser.
  '/api/admin/logout',
  // Where an invited admin sets their first password. The token in the request
  // body is the credential, and the route checks it.
  '/api/admin/accept-invite',
]);
