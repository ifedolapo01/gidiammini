import { describe, expect, it } from 'vitest';
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  productBreadcrumbTrail,
} from './product-jsonld';
import { ORIGIN, product, sitewide, variant } from './product-fixtures';
import type { PublicReview } from './reviews';
import { NO_REVIEWS } from './rating-math';

describe('buildProductJsonLd', () => {
  const url = `${ORIGIN}/products/11111111-1111-4111-8111-111111111111`;

  it('emits a single Offer when every variant costs the same', () => {
    const jsonLd = buildProductJsonLd(product(), [], url, ORIGIN) as any;
    expect(jsonLd['@type']).toBe('Product');
    expect(jsonLd.offers['@type']).toBe('Offer');
    expect(jsonLd.offers.price).toBe(5000);
    expect(jsonLd.offers.priceCurrency).toBe('NGN');
    expect(jsonLd.offers.availability).toBe('https://schema.org/InStock');
    expect(jsonLd.offers.url).toBe(url);
    expect(jsonLd.sku).toBe(product().id);
  });

  it('emits an AggregateOffer with a count of the sellable variants when prices range', () => {
    const ranged = product({
      product_variants: [
        variant({ id: 'a', price: 4000, variant_key: 'S' }),
        variant({ id: 'b', price: 12000, variant_key: 'M' }),
        variant({ id: 'c', price: 8000, variant_key: 'L', is_active: false }),
      ],
    });
    const offers = (buildProductJsonLd(ranged, [], url, ORIGIN) as any).offers;
    expect(offers['@type']).toBe('AggregateOffer');
    expect(offers.lowPrice).toBe(4000);
    expect(offers.highPrice).toBe(12000);
    expect(offers.offerCount).toBe(2);
  });

  it('reports OutOfStock so the SERP does not offer a sold-out product', () => {
    const soldOut = product({ stock: 0, product_variants: [variant({ stock: 0 })] });
    expect((buildProductJsonLd(soldOut, [], url, ORIGIN) as any).offers.availability).toBe(
      'https://schema.org/OutOfStock'
    );
  });

  it('publishes the discounted price, matching what the page displays', () => {
    const offers = (buildProductJsonLd(product(), [sitewide({ value: 20 })], url, ORIGIN) as any).offers;
    expect(offers.price).toBe(4000);
  });

  it('omits colour and size when the product has none, rather than sending empty arrays', () => {
    const bare = buildProductJsonLd(product(), [], url, ORIGIN);
    expect(bare).not.toHaveProperty('color');
    expect(bare).not.toHaveProperty('size');

    const dressed = buildProductJsonLd(
      product({ colors: ['red'], sizes: ['S', 'M'] }),
      [],
      url,
      ORIGIN
    ) as any;
    expect(dressed.color).toEqual(['red']);
    expect(dressed.size).toEqual(['S', 'M']);
  });

  it('survives a name containing markup — the renderer escapes, but the JSON stays valid', () => {
    const hostile = product({ name: '</script><img src=x>' });
    const serialized = JSON.stringify(buildProductJsonLd(hostile, [], url, ORIGIN));
    expect(JSON.parse(serialized).name).toBe('</script><img src=x>');
    expect(serialized.replace(/</g, '\\u003c')).not.toContain('</script>');
  });
});

const review = (over: Partial<PublicReview> = {}): PublicReview => ({
  id: 'r1',
  rating: 5,
  title: 'Softer than expected',
  body: 'Washed twice, still perfect.',
  author_name: 'Ada O.',
  variant_label: '3-6M / Cream',
  is_verified_purchase: true,
  photos: [],
  admin_response: null,
  created_at: '2026-08-27T10:34:00.000Z',
  ...over,
});

describe('buildProductJsonLd ratings', () => {
  const url = `${ORIGIN}/products/11111111-1111-4111-8111-111111111111`;

  it('omits aggregateRating entirely when nothing has been reviewed', () => {
    // An aggregateRating with reviewCount 0 is a structured-data error, not a
    // neutral statement — so the absence has to be a real absence.
    const bare = buildProductJsonLd(product(), [], url, ORIGIN);
    expect(bare).not.toHaveProperty('aggregateRating');
    expect(bare).not.toHaveProperty('review');

    const empty = buildProductJsonLd(product(), [], url, ORIGIN, {
      stats: NO_REVIEWS,
      reviews: [],
    });
    expect(empty).not.toHaveProperty('aggregateRating');
  });

  it('publishes the same rounded average the page displays', () => {
    const jsonLd = buildProductJsonLd(product(), [], url, ORIGIN, {
      stats: { ...NO_REVIEWS, review_count: 3, rating_average: 4.67 },
      reviews: [review()],
    }) as any;

    expect(jsonLd.aggregateRating).toMatchObject({
      '@type': 'AggregateRating',
      ratingValue: 4.7,
      reviewCount: 3,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it('emits each review with the author and rating Google requires', () => {
    const jsonLd = buildProductJsonLd(product(), [], url, ORIGIN, {
      stats: { ...NO_REVIEWS, review_count: 1, rating_average: 5 },
      reviews: [review()],
    }) as any;

    expect(jsonLd.review).toHaveLength(1);
    expect(jsonLd.review[0]).toMatchObject({
      '@type': 'Review',
      name: 'Softer than expected',
      reviewBody: 'Washed twice, still perfect.',
      author: { '@type': 'Person', name: 'Ada O.' },
      reviewRating: { ratingValue: 5, bestRating: 5, worstRating: 1 },
      // Date only: the minute somebody wrote a review is nobody's business.
      datePublished: '2026-08-27',
    });
  });

  it('omits a review title and body it does not have, rather than sending empty strings', () => {
    const jsonLd = buildProductJsonLd(product(), [], url, ORIGIN, {
      stats: { ...NO_REVIEWS, review_count: 1, rating_average: 4 },
      reviews: [review({ rating: 4, title: null, body: null })],
    }) as any;

    expect(jsonLd.review[0]).not.toHaveProperty('name');
    expect(jsonLd.review[0]).not.toHaveProperty('reviewBody');
  });

  it('sends at most five reviews, however many are published', () => {
    const many = Array.from({ length: 12 }, (_unused, index) => review({ id: `r${index}` }));
    const jsonLd = buildProductJsonLd(product(), [], url, ORIGIN, {
      stats: { ...NO_REVIEWS, review_count: 12, rating_average: 5 },
      reviews: many,
    }) as any;

    expect(jsonLd.review).toHaveLength(5);
    // The aggregate still counts all of them — that is the number the stars
    // in a search listing are based on.
    expect(jsonLd.aggregateRating.reviewCount).toBe(12);
  });
});

describe('breadcrumbs', () => {
  it('runs home → collection → category → product, using the category display name', () => {
    const trail = productBreadcrumbTrail(product(), 'Baby Essentials', ORIGIN);
    expect(trail.map((crumb) => crumb.name)).toEqual([
      'Home',
      'Our Collection',
      'Baby Essentials',
      'Ribbed Bodysuit',
    ]);
    expect(trail[2].url).toBe(`${ORIGIN}/products?category=baby-essentials`);
    expect(trail[3].url).toBe(`${ORIGIN}/products/${product().id}`);
  });

  it('de-slugs the category when no display name was found', () => {
    const trail = productBreadcrumbTrail(product(), null, ORIGIN);
    expect(trail[2].name).toBe('baby essentials');
  });

  it('drops the category crumb rather than linking to an unfiltered listing', () => {
    const trail = productBreadcrumbTrail(product({ category: '' }), null, ORIGIN);
    expect(trail.map((crumb) => crumb.name)).toEqual(['Home', 'Our Collection', 'Ribbed Bodysuit']);
  });

  it('numbers positions from 1, in order', () => {
    const jsonLd = buildBreadcrumbJsonLd(productBreadcrumbTrail(product(), 'Baby', ORIGIN)) as any;
    expect(jsonLd['@type']).toBe('BreadcrumbList');
    expect(jsonLd.itemListElement.map((item: any) => item.position)).toEqual([1, 2, 3, 4]);
  });
});

