/**
 * COMMERCE layer — the schema.org graph a product page publishes.
 *
 * Split from product-seo.ts, which is now purely the <head>: title text,
 * snippet, image URLs and the sitemap's escaping. The two answer different
 * questions — "what does this page say about itself" and "what machine-
 * readable claims does it make about price and availability" — and only the
 * second is a claim Google will issue a manual action over, so it is worth
 * reading on its own.
 *
 * Pure: no Next, no React, no database, so every claim is testable without
 * rendering a page.
 */
import type { Product } from '@/types/product';
import { absoluteUrl } from '@/lib/site-url';
import type { Discount } from './discounts';
import { BRAND_NAME, CURRENCY, offerPriceRange, productInStock, productMetaDescription, productImageUrls } from './product-seo';
import { variantsOf } from './product-variants';
import type { PublicReview } from './reviews';
import { formatRatingAverage, type ReviewStats } from './rating-math';

export interface Crumb {
  name: string;
  /** Absolute. Schema.org's `item` is a URL, not a path. */
  url: string;
}

/** How many distinct things are actually buyable — AggregateOffer.offerCount. */
function sellableVariantCount(product: Product): number {
  const active = variantsOf(product).filter((variant) => variant.is_active);
  return active.length > 0 ? active.length : 1;
}

/** What the page knows about its own reviews, when it has any. */
export interface ReviewJsonLdInput {
  stats: ReviewStats;
  /** Newest first. Only the first few are emitted — see REVIEWS_IN_JSONLD. */
  reviews: PublicReview[];
}

/**
 * How many individual reviews travel in the graph.
 *
 * The aggregate is what earns the stars in a search listing; the individual
 * reviews are what let Google quote one. Sending twenty would bloat every
 * product page's head for no additional eligibility.
 */
const REVIEWS_IN_JSONLD = 5;

/**
 * The rating claims: an aggregateRating, plus a few reviews Google may quote.
 *
 * Only published reviews reach here — the aggregate view filters on status —
 * so this cannot advertise a rating built from something no human has read.
 * Emitted only when there is at least one review: an aggregateRating with
 * reviewCount 0 is a structured-data error, not a neutral statement.
 */
function ratingClaims(input: ReviewJsonLdInput | undefined): Record<string, unknown> {
  if (!input || input.stats.review_count <= 0) return {};

  return {
    aggregateRating: {
      '@type': 'AggregateRating',
      // The number the page displays, not the raw two-decimal average — a SERP
      // star rating that disagrees with the product page is the sort of
      // mismatch a manual action is issued over.
      ratingValue: Number(formatRatingAverage(input.stats.rating_average)),
      reviewCount: input.stats.review_count,
      bestRating: 5,
      worstRating: 1,
    },
    review: input.reviews.slice(0, REVIEWS_IN_JSONLD).map((review) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { '@type': 'Person', name: review.author_name },
      // Date only. The graph is a public document and the minute somebody
      // wrote a review is nobody's business.
      datePublished: review.created_at.slice(0, 10),
      ...(review.title ? { name: review.title } : {}),
      ...(review.body ? { reviewBody: review.body } : {}),
    })),
  };
}

/**
 * Product structured data, with an Offer when there is one price and an
 * AggregateOffer when the variants span a range. Google accepts both; the
 * distinction matters because a single `price` on a product ranging from
 * ₦4,000 to ₦12,000 is a SERP price the shopper cannot find on the page.
 */
export function buildProductJsonLd(
  product: Product,
  discounts: Discount[],
  url: string,
  origin?: string,
  reviews?: ReviewJsonLdInput
): Record<string, unknown> {
  const { min, max } = offerPriceRange(product, discounts);
  const availability = productInStock(product)
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';

  const offerBase = {
    priceCurrency: CURRENCY,
    availability,
    itemCondition: 'https://schema.org/NewCondition',
    url,
  };

  const offers =
    min === max
      ? { '@type': 'Offer', price: min, ...offerBase }
      : {
          '@type': 'AggregateOffer',
          lowPrice: min,
          highPrice: max,
          offerCount: sellableVariantCount(product),
          ...offerBase,
        };

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: productMetaDescription(product),
    image: productImageUrls(product, origin),
    // The route is /products/<uuid>, so the id is what a shopper and a crawler
    // both address the product by. There is no SKU column on products.
    sku: product.id,
    productID: product.id,
    url,
    category: product.sub_category || product.category,
    brand: { '@type': 'Brand', name: BRAND_NAME },
    ...(product.colors?.length ? { color: product.colors } : {}),
    ...(product.sizes?.length ? { size: product.sizes } : {}),
    ...ratingClaims(reviews),
    offers,
  };
}

/** BreadcrumbList, in the order the crumbs are given. */
export function buildBreadcrumbJsonLd(trail: Crumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/**
 * Home → Our Collection → category → product.
 *
 * The category crumb is dropped when the product has no category rather than
 * emitting a link to `/products?category=` — a crumb pointing at an unfiltered
 * listing is a crumb that lies about where the product sits.
 */
export function productBreadcrumbTrail(
  product: Pick<Product, 'id' | 'name' | 'category'>,
  categoryName: string | null,
  origin?: string
): Crumb[] {
  const trail: Crumb[] = [
    { name: 'Home', url: absoluteUrl('/', origin) },
    { name: 'Our Collection', url: absoluteUrl('/products', origin) },
  ];

  if (product.category) {
    trail.push({
      name: categoryName || product.category.replace(/[-_]/g, ' '),
      url: absoluteUrl(`/products?category=${encodeURIComponent(product.category)}`, origin),
    });
  }

  trail.push({ name: product.name, url: absoluteUrl(`/products/${product.id}`, origin) });
  return trail;
}
