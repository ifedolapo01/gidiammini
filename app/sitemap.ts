/**
 * STOREFRONT layer — the sitemap, generated from the catalogue.
 *
 * Without one, a crawler can only find a product by walking the listing, and
 * the listing paginates behind a "Load more" button that is a client-side
 * fetch — so the catalogue past the first page was effectively undiscoverable.
 *
 * Category listings are included because they are the pages a category query
 * should rank for; the other facets (size, colour, price, sort) are not, since
 * they multiply into thousands of near-identical URLs. Filters are canonicalised
 * away by /products' own metadata rather than crawled.
 */
import type { MetadataRoute } from 'next';
import { loadSitemapCategories, loadSitemapProducts } from '@/lib/commerce/product-detail-query';
import { sitemapLoc } from '@/lib/commerce/product-seo';
import { absoluteUrl } from '@/lib/site-url';

/** Rebuilt hourly. New products appear within the hour without a deploy, and a
 *  crawl never triggers a full-catalogue query. */
export const revalidate = 3600;

/** Pages that exist regardless of the catalogue, with how much they matter
 *  relative to each other. Cart, checkout, wishlist and track-order are absent
 *  on purpose — they are per-shopper and have nothing to index. */
const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/products', priority: 0.9, changeFrequency: 'daily' },
  { path: '/contact', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/shipping', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/returns', priority: 0.4, changeFrequency: 'monthly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    loadSitemapProducts(),
    loadSitemapCategories(),
  ]);

  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: sitemapLoc(absoluteUrl(route.path)),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.flatMap((category) => [
    {
      url: sitemapLoc(absoluteUrl(`/products?category=${encodeURIComponent(category.slug)}`)),
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
    ...category.subcategories.map((subcategory) => ({
      url: sitemapLoc(
        absoluteUrl(
          `/products?category=${encodeURIComponent(category.slug)}&subcategory=${encodeURIComponent(subcategory)}`
        )
      ),
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
  ]);

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: sitemapLoc(absoluteUrl(`/products/${product.id}`)),
    lastModified: product.updated_at ? new Date(product.updated_at) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
