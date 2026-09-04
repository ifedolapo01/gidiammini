/**
 * The header, the footer and the product cards all name a category through
 * these, so "what is this category called" has to have exactly one answer —
 * the bug being fixed was three answers, two of them hardcoded.
 */
import { describe, it, expect } from 'vitest';
import {
  categoryLabel,
  findCategoryLabel,
  buildStorefrontNavLinks,
  type CategoryNavItem,
} from './storefront-nav';

const nav = (overrides: Partial<CategoryNavItem> = {}): CategoryNavItem => ({
  name: 'Kids & Pre-Teens',
  slug: 'kids',
  label: 'Kids & Pre-teens',
  ...overrides,
});

describe('categoryLabel', () => {
  it('prefers display_name', () => {
    expect(categoryLabel({ name: 'Kids & Pre-Teens', display_name: 'Big Kids' })).toBe('Big Kids');
  });

  it('falls back to name when display_name is unset or blank', () => {
    expect(categoryLabel({ name: 'Babies', display_name: null })).toBe('Babies');
    expect(categoryLabel({ name: 'Babies', display_name: '   ' })).toBe('Babies');
    expect(categoryLabel({ name: 'Babies' })).toBe('Babies');
  });
});

describe('findCategoryLabel', () => {
  it('matches a slug case-insensitively', () => {
    expect(findCategoryLabel([nav()], 'KIDS')).toBe('Kids & Pre-teens');
  });

  it('falls back to the slug for an unknown category', () => {
    // A product whose category row was deleted, or a card rendered before the
    // list arrived. `capitalize` in the markup makes this read properly.
    expect(findCategoryLabel([nav()], 'babies')).toBe('babies');
    expect(findCategoryLabel([], 'maternity')).toBe('maternity');
  });
});

describe('buildStorefrontNavLinks', () => {
  it('puts Home and All Products before the categories', () => {
    const links = buildStorefrontNavLinks([nav({ slug: 'babies', label: 'Babies' })]);
    expect(links.map((link) => link.label)).toEqual(['Home', 'All Products', 'Babies']);
    expect(links[0].category).toBeUndefined();
    expect(links[2]).toMatchObject({ href: '/products?category=babies', category: 'babies' });
  });

  it('encodes a slug that needs it', () => {
    const links = buildStorefrontNavLinks([nav({ slug: 'back to school', label: 'Back to School' })]);
    expect(links[2].href).toBe('/products?category=back%20to%20school');
  });

  it('renders the fixed links with no categories at all', () => {
    // What a database read that failed leaves us with; the site still navigates.
    expect(buildStorefrontNavLinks([])).toHaveLength(2);
  });
});
