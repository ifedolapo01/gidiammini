/**
 * Every admin API route is authorised, and the build fails if a new one is not.
 *
 * The middleware refuses an unauthenticated /api/admin request, but that is
 * defence in depth: it trusts the `admin` claim in the JWT, which only changes
 * when a token refreshes, so a deactivated admin still passes it. The real
 * guard is per-route — withAdminAuth for all but a handful, which is also what
 * applies the permission model (lib/api/admin-route-permissions.ts).
 *
 * So "one new route that forgets the wrapper is silently public" was true of
 * the route layer, and nothing caught it. This does: it reads every route file
 * on disk and checks the handlers it actually exports.
 *
 * Adding a route with a bare `export async function GET` fails here. That is
 * the point — the fix is to wrap it, not to add it to the list below.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, sep } from 'node:path';
import { PUBLIC_ADMIN_API_PATHS } from './admin-public-paths';

const ROUTES_DIR = join(process.cwd(), 'app', 'api', 'admin');

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

/**
 * Routes that authorise themselves some other way, each with the reason and
 * the symbol that has to be present for the claim to hold.
 *
 * `guard: null` means genuinely public, and those must also be listed in
 * PUBLIC_ADMIN_API_PATHS — asserted below, so the middleware and this file
 * cannot disagree about which endpoints need no session.
 */
const EXEMPT: Record<string, { why: string; guard: string | null }> = {
  'login': { why: 'the credential exchange itself', guard: null },
  'logout': {
    why: 'an invalid session must still be able to clear its cookies',
    guard: null,
  },
  'accept-invite': {
    why: 'an invited admin has no session yet; the token in the body is the credential',
    guard: null,
  },
  'session': {
    why: 'reports who you are, and answers for a signed-out caller too',
    guard: 'getAdminActor',
  },
  'realtime-token': {
    why: 'mints the realtime token; needs the actor, not the route wrapper',
    guard: 'getAdminActor',
  },
  'alerts/dashboard-stats': { why: 'predates withAdminAuth', guard: 'isAdminRequest' },
  'alerts/overdue-shipments': { why: 'predates withAdminAuth', guard: 'isAdminRequest' },
  'alerts/pending-change-requests': { why: 'predates withAdminAuth', guard: 'isAdminRequest' },
  'alerts/pending-orders': { why: 'predates withAdminAuth', guard: 'isAdminRequest' },
  'products/negative-stock': { why: 'predates withAdminAuth', guard: 'isAdminRequest' },
};

/** Route ids ('products/[id]/stock') for every route.ts under app/api/admin. */
function routeIds(dir: string, prefix = ''): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...routeIds(join(dir, entry.name), prefix ? posix.join(prefix, entry.name) : entry.name));
    } else if (entry.name === 'route.ts') {
      found.push(prefix);
    }
  }

  return found;
}

/**
 * Comments removed before anything is matched.
 *
 * Not cosmetic: app/api/admin/logout/route.ts explains in its header that it is
 * "deliberately not wrapped in withAdminAuth", and a plain substring search for
 * the wrapper name reads that as proof it is wrapped. The `:` guard leaves
 * `https://` alone, which is all a URL in a comment needs here.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');
}

interface Handler {
  method: string;
  wrapped: boolean;
}

function handlersIn(source: string): Handler[] {
  const code = stripComments(source);
  const handlers: Handler[] = [];

  for (const method of HTTP_METHODS) {
    // `export const GET = withAdminAuth(...)` — the wrapped form.
    const assigned = new RegExp(String.raw`export\s+const\s+${method}\s*(?::[^=]+)?=\s*([\s\S]{0,80})`);
    const match = code.match(assigned);
    if (match) {
      handlers.push({ method, wrapped: /^\s*withAdminAuth\s*\(/.test(match[1]) });
      continue;
    }

    // `export async function GET()` — never wrapped, by construction.
    if (new RegExp(String.raw`export\s+(?:async\s+)?function\s+${method}\s*\(`).test(code)) {
      handlers.push({ method, wrapped: false });
    }
  }

  return handlers;
}

const routes = routeIds(ROUTES_DIR).map((id) => ({
  id,
  handlers: handlersIn(readFileSync(join(ROUTES_DIR, ...id.split('/'), 'route.ts'), 'utf8')),
}));

describe('admin route coverage', () => {
  it('finds the route files at all', () => {
    // A broken walk would make every assertion below vacuously true, which is
    // the one failure mode this suite could not otherwise notice.
    expect(routes.length).toBeGreaterThan(40);
  });

  it('exports at least one handler per route file', () => {
    const empty = routes.filter((route) => route.handlers.length === 0).map((route) => route.id);
    expect(empty).toEqual([]);
  });

  it('wraps every handler in withAdminAuth, or documents why not', () => {
    const unguarded = routes
      .filter((route) => !(route.id in EXEMPT))
      .flatMap((route) =>
        route.handlers
          .filter((handler) => !handler.wrapped)
          .map((handler) => `${route.id} (${handler.method})`)
      );

    // A new admin route landing here has no authorisation of its own. Wrap the
    // handler in withAdminAuth rather than adding it to EXEMPT.
    expect(unguarded).toEqual([]);
  });

  it('holds every exempt route to the guard it claims', () => {
    const broken: string[] = [];

    for (const [id, { guard }] of Object.entries(EXEMPT)) {
      if (!guard) continue;
      const source = readFileSync(join(ROUTES_DIR, ...id.split('/'), 'route.ts'), 'utf8');
      if (!stripComments(source).includes(guard)) broken.push(`${id} no longer calls ${guard}`);
    }

    expect(broken).toEqual([]);
  });

  it('lists every exempt route that really exists', () => {
    // Stops the list rotting into a set of permanent excuses for routes that
    // were deleted or renamed years ago.
    const ids = new Set(routes.map((route) => route.id));
    const stale = Object.keys(EXEMPT).filter((id) => !ids.has(id));
    expect(stale).toEqual([]);
  });

  it('agrees with the middleware about which endpoints are public', () => {
    const publicHere = Object.entries(EXEMPT)
      .filter(([, { guard }]) => guard === null)
      .map(([id]) => `/api/admin/${id}`)
      .sort();

    expect(publicHere).toEqual([...PUBLIC_ADMIN_API_PATHS].sort());
  });
});
