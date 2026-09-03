import { describe, it, expect } from 'vitest';
import {
  parseProductFilters,
  productFiltersToQuery,
  productFiltersToHref,
  countActiveFilters,
  applyFilterChange,
  toggleFacetValue,
  DEFAULT_FILTERS,
} from './product-filters';
import { compareSizes, sortSizes } from './size-order';
import { buildPriceBands, matchPriceBand, describePriceRange } from './price-bands';

const parse = (query: string) => parseProductFilters(new URLSearchParams(query));

describe('parseProductFilters', () => {
  it('returns the defaults for an empty query', () => {
    expect(parse('')).toEqual(DEFAULT_FILTERS);
  });

  it('treats a missing params object as defaults rather than throwing', () => {
    expect(parseProductFilters(null)).toEqual(DEFAULT_FILTERS);
  });

  it('reads every facet', () => {
    const filters = parse(
      'category=gowns&subcategory=christening&min=5000&max=9999&size=S&size=M&color=Blue&sale=1&stock=in&sort=price_asc'
    );

    expect(filters).toEqual({
      category: 'gowns',
      subcategory: 'christening',
      minPrice: 5000,
      maxPrice: 9999,
      sizes: ['S', 'M'],
      colors: ['Blue'],
      onSale: true,
      inStockOnly: true,
      sort: 'price_asc',
    });
  });

  it('shows sold-out products by default; hiding them is an explicit opt-in', () => {
    // Hiding them cost the store the indexed page and the restock signal, so
    // the storefront no longer decides this on the shopper's behalf.
    expect(parse('').inStockOnly).toBe(false);
    expect(parse('stock=all').inStockOnly).toBe(false);
    expect(parse('stock=in').inStockOnly).toBe(true);
  });

  it('falls back to the default sort rather than trusting a pasted value', () => {
    expect(parse('sort=cheapest').sort).toBe('newest');
    expect(parse('sort=best_selling').sort).toBe('best_selling');
  });

  it('drops blank and duplicate facet values', () => {
    expect(parse('size=S&size=&size=S&size=M').sizes).toEqual(['S', 'M']);
  });

  it('swaps a reversed price band instead of matching nothing', () => {
    const filters = parse('min=9000&max=2000');
    expect(filters.minPrice).toBe(2000);
    expect(filters.maxPrice).toBe(9000);
  });

  it('ignores a page param — paging is a cursor the URL does not carry', () => {
    expect(parse('page=4')).toEqual(DEFAULT_FILTERS);
  });
});

describe('productFiltersToQuery', () => {
  it('writes nothing for an untouched filter set', () => {
    expect(productFiltersToQuery(DEFAULT_FILTERS).toString()).toBe('');
    expect(productFiltersToHref(DEFAULT_FILTERS)).toBe('/products');
  });

  it('round-trips every facet back to the same state', () => {
    const original = parse(
      'category=gowns&subcategory=christening&min=5000&max=9999&size=S&size=M&color=Blue&sale=1&stock=in&sort=price_desc'
    );
    expect(parseProductFilters(productFiltersToQuery(original))).toEqual(original);
  });

  it('omits defaults so one view has one URL', () => {
    const query = productFiltersToQuery({ ...DEFAULT_FILTERS, category: 'gowns' }).toString();
    expect(query).toBe('category=gowns');
  });
});

describe('countActiveFilters', () => {
  it('is zero on an untouched page, and ignores sort and paging', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, sort: 'name' })).toBe(0);
  });

  it('counts each selected value', () => {
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, sizes: ['S', 'M'], colors: ['Blue'], onSale: true })
    ).toBe(4);
  });
});

describe('applyFilterChange', () => {
  it('merges one facet without disturbing the rest', () => {
    const narrowed = applyFilterChange({ ...DEFAULT_FILTERS, colors: ['Blue'] }, { sizes: ['S'] });
    expect(narrowed.sizes).toEqual(['S']);
    expect(narrowed.colors).toEqual(['Blue']);
  });
});

describe('toggleFacetValue', () => {
  it('adds then removes', () => {
    expect(toggleFacetValue([], 'S')).toEqual(['S']);
    expect(toggleFacetValue(['S', 'M'], 'S')).toEqual(['M']);
  });
});

describe('compareSizes', () => {
  it('orders letter sizes small to large, not alphabetically', () => {
    expect(sortSizes(['XL', 'S', 'M', 'XS', 'L'])).toEqual(['XS', 'S', 'M', 'L', 'XL']);
  });

  it('treats 2XL and XXL as the same rank', () => {
    expect(compareSizes('2XL', 'XL')).toBeGreaterThan(0);
    expect(compareSizes('XXL', 'XL')).toBeGreaterThan(0);
  });

  it('orders age bands numerically — the bug alphabetical sorting causes', () => {
    expect(sortSizes(['12-18 months', '0-3 months', '3-6 months', '6-9 months'])).toEqual([
      '0-3 months',
      '3-6 months',
      '6-9 months',
      '12-18 months',
    ]);
  });

  it('puts months below years', () => {
    expect(sortSizes(['2 years', '18 months', '1 year'])).toEqual([
      '1 year',
      '18 months',
      '2 years',
    ]);
  });

  it('sorts letter sizes before numeric ones, and unknowns last', () => {
    expect(sortSizes(['One Size', '2', 'M'])).toEqual(['M', '2', 'One Size']);
  });
});

describe('buildPriceBands', () => {
  it('returns nothing when there is no range to divide', () => {
    expect(buildPriceBands(0, 0)).toEqual([]);
    expect(buildPriceBands(5000, 5000)).toEqual([]);
  });

  it('covers the range without overlapping', () => {
    const bands = buildPriceBands(1500, 60000);
    expect(bands.length).toBeGreaterThan(1);
    expect(bands[0].min).toBeNull();
    expect(bands[bands.length - 1].max).toBeNull();

    for (let i = 1; i < bands.length; i++) {
      // Each band starts exactly where the previous one stopped.
      expect(bands[i].min).toBe((bands[i - 1].max as number) + 1);
    }
  });

  it('matches a selection back to the band that produced it', () => {
    const bands = buildPriceBands(1500, 60000);
    const band = bands[1];
    expect(matchPriceBand(bands, band.min, band.max)).toEqual(band);
    expect(matchPriceBand(bands, 123, 456)).toBeNull();
  });
});

describe('describePriceRange', () => {
  it('describes open-ended and closed ranges', () => {
    expect(describePriceRange(null, null)).toBe('Any price');
    expect(describePriceRange(5000, null)).toContain('5,000');
    expect(describePriceRange(null, 4999)).toContain('Under');
  });
});
