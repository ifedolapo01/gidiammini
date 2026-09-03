/**
 * STOREFRONT layer — robots.txt.
 *
 * The store had none, so a crawler had no pointer to the sitemap and no reason
 * not to spend its budget on the admin login, the cart and the checkout —
 * pages that are per-shopper, behind auth, or both, and have nothing to index.
 *
 * Disallow here is a crawl instruction, not a security control: /admin is
 * protected by middleware.ts, and listing it costs nothing because the paths
 * are already visible in the client bundle.
 */
import type { MetadataRoute } from 'next';
import { SITE_URL, absoluteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/api/',
        '/cart',
        '/checkout',
        '/wishlist',
        '/track-order',
        // Internal search results: thin, infinite, and duplicates of the
        // listing pages that are meant to rank instead.
        '/search',
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  };
}
