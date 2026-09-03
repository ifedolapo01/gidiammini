import { describe, expect, it } from 'vitest';
import {
  sitemapLoc,
  offerPriceRange,
  productImageUrls,
  productInStock,
  productMetaDescription,
  truncateForMeta,
} from './product-seo';
import { ORIGIN, product, sitewide, variant } from './product-fixtures';

describe('truncateForMeta', () => {
  it('leaves short text alone but collapses whitespace', () => {
    expect(truncateForMeta('  a   soft\nbodysuit ')).toBe('a soft bodysuit');
  });

  it('cuts on a word boundary and never exceeds the limit', () => {
    const text = 'word '.repeat(60);
    const result = truncateForMeta(text, 40);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('  ');
  });

  it('cuts mid-word rather than dropping most of the string', () => {
    const result = truncateForMeta(`short ${'x'.repeat(80)}`, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.startsWith('short x')).toBe(true);
  });
});

describe('productMetaDescription', () => {
  it('uses the written description when there is one', () => {
    expect(productMetaDescription(product())).toBe('A soft ribbed cotton bodysuit.');
  });

  it('composes one naming the product when the description is blank', () => {
    const composed = productMetaDescription(product({ description: '   ' }));
    expect(composed).toContain('Ribbed Bodysuit');
    // The slug is de-slugged, so the snippet reads as a sentence.
    expect(composed).toContain('baby essentials');
  });
});

describe('productImageUrls', () => {
  it('puts the main image first, absolutises the rest and de-duplicates', () => {
    const urls = productImageUrls(
      product({ main_image: '/images/a.png', images: ['/images/a.png', 'https://cdn.example/b.jpg', ''] }),
      ORIGIN
    );
    expect(urls).toEqual(['https://shop.example/images/a.png', 'https://cdn.example/b.jpg']);
  });
});

describe('productInStock', () => {
  it('reads variant rows when they are loaded, not products.stock', () => {
    // The stale products.stock is exactly the case that would advertise a
    // sold-out product as available in the SERP.
    const soldOut = product({ stock: 12, product_variants: [variant({ stock: 0 })] });
    expect(productInStock(soldOut)).toBe(false);

    const available = product({ stock: 0, product_variants: [variant({ stock: 2 })] });
    expect(productInStock(available)).toBe(true);
  });

  it('ignores inactive variants', () => {
    expect(productInStock(product({ product_variants: [variant({ is_active: false })] }))).toBe(false);
  });

  it('falls back to products.stock when no rows were loaded', () => {
    expect(productInStock(product({ stock: 0 }))).toBe(false);
    expect(productInStock(product({ stock: 1 }))).toBe(true);
  });
});

describe('offerPriceRange', () => {
  it('spans the active variant prices', () => {
    const ranged = product({
      product_variants: [
        variant({ id: 'a', price: 4000, variant_key: 'S' }),
        variant({ id: 'b', price: 12000, variant_key: 'M' }),
        variant({ id: 'c', price: 99000, variant_key: 'L', is_active: false }),
      ],
    });
    expect(offerPriceRange(ranged, [])).toEqual({ min: 4000, max: 12000 });
  });

  it('applies the discount to each end independently', () => {
    const ranged = product({
      product_variants: [
        variant({ id: 'a', price: 4000, variant_key: 'S' }),
        variant({ id: 'b', price: 12000, variant_key: 'M' }),
      ],
    });
    expect(offerPriceRange(ranged, [sitewide({ value: 25 })])).toEqual({ min: 3000, max: 9000 });
  });

  it('does not report a negative low end when a FIXED discount exceeds the price', () => {
    const ranged = product({
      product_variants: [
        variant({ id: 'a', price: 1500, variant_key: 'S' }),
        variant({ id: 'b', price: 9000, variant_key: 'M' }),
      ],
    });
    const range = offerPriceRange(ranged, [sitewide({ type: 'FIXED', value: 2000 })]);
    expect(range).toEqual({ min: 0, max: 7000 });
    expect(range.min).toBeLessThanOrEqual(range.max);
  });
});

describe('sitemapLoc', () => {
  it('escapes the ampersand a two-facet listing URL carries', () => {
    // Verified against the served /sitemap.xml: Next 16 writes <loc> verbatim,
    // so the unescaped form made the whole file fail to parse.
    expect(sitemapLoc('https://a.example/products?category=babies&subcategory=babies-tops')).toBe(
      'https://a.example/products?category=babies&amp;subcategory=babies-tops'
    );
  });

  it('leaves a URL with nothing to escape byte-identical', () => {
    const plain = 'https://a.example/products/11111111-1111-4111-8111-111111111111';
    expect(sitemapLoc(plain)).toBe(plain);
  });

  it('escapes every character XML forbids in element content, ampersand first', () => {
    // Ampersand last would double-escape the entities the other rules emit.
    expect(sitemapLoc(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });
});
