/**
 * CORE layer — the store's public origin, in one place.
 *
 * `process.env.NEXT_PUBLIC_SITE_URL || 'https://gidiammini.com'` was written
 * out five separate times (email templates, the discount cron, the subscribe
 * route, stock alerts), each with its own idea of trailing-slash handling. One
 * of them produced ".../track-order" and another "...//track-order" from the
 * same env value. Canonical URLs, sitemap entries and og:url now come from
 * here too, so what the crawler is told and what an email links to cannot
 * drift apart.
 *
 * The trailing slash is stripped once, here, so callers can always concatenate
 * a leading-slash path.
 */

/** Used when NEXT_PUBLIC_SITE_URL is unset or empty — the production domain. */
const FALLBACK_ORIGIN = 'https://gidiammini.com';

/** The absolute origin, no trailing slash. */
export const SITE_URL: string = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);

/** Strips trailing slashes; an unset *or empty* env var falls back. An empty
 *  string is a misconfiguration, not a request for a relative site. */
export function normalizeOrigin(origin: string | undefined | null): string {
  const trimmed = (origin ?? '').trim().replace(/\/+$/, '');
  return trimmed === '' ? FALLBACK_ORIGIN : trimmed;
}

/**
 * An absolute URL for a site-relative path. Passes an already-absolute URL
 * through untouched, which is what makes it safe to hand a product's
 * `main_image` — some are Cloudinary URLs, some are local `/images/...` paths,
 * and og:image must be absolute either way.
 */
export function absoluteUrl(path: string, origin: string = SITE_URL): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('//')) return `https:${path}`;
  return `${origin}/${path.replace(/^\/+/, '')}`;
}
