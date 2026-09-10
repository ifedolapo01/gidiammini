/**
 * The import wizard's category-resolution step is built entirely on these
 * functions — what counts as an exact match, what counts as a suggestion, and
 * how "Baby Gear" gets recognised as two existing levels squashed into one
 * cell. If these drift, the resolver either asks about things that already
 * match, or silently resolves things that don't.
 */
import { describe, it, expect } from 'vitest';
import type { Category } from '@/types/product';
import {
  extractCategoryTerms,
  matchCategory,
  matchSubcategory,
  matchSubSubcategory,
  suggestCategory,
  suggestSubcategory,
  suggestSubSubcategory,
  suggestCategorySplit,
  resolveCategoryValue,
  resolveCategorySplit,
  resolveSubCategoryValue,
  resolveSubSubCategoryValue,
  subCategoryOverrideKey,
  subSubCategoryOverrideKey,
  type CategoryOverrides,
} from './product-import-categories';

const categories: Category[] = [
  {
    id: 'cat-babies',
    name: 'Babies',
    slug: 'babies',
    color: '',
    subcategories: [
      {
        id: 'sub-gear',
        name: 'Gear',
        slug: 'gear',
        category_slug: 'babies',
        subsubcategories: [
          { id: 'subsub-monitors', name: 'Monitors', slug: 'gear-monitors', subcategory_slug: 'gear' },
        ],
      },
      { id: 'sub-clothing', name: 'Clothing', slug: 'clothing', category_slug: 'babies', subsubcategories: [] },
    ],
  },
  {
    id: 'cat-mens',
    name: "Men's Clothing",
    slug: 'mens-clothing',
    color: '',
    subcategories: [],
  },
];

describe('matchCategory', () => {
  it('matches an existing slug', () => {
    expect(matchCategory('babies', categories)?.slug).toBe('babies');
  });

  it('matches by name, case-insensitively', () => {
    expect(matchCategory('BABIES', categories)?.slug).toBe('babies');
  });

  it('matches a name that only differs by punctuation once slugified', () => {
    expect(matchCategory("Men's Clothing", categories)?.slug).toBe('mens-clothing');
  });

  it('returns undefined for genuinely unknown text', () => {
    expect(matchCategory('Toys', categories)).toBeUndefined();
  });
});

describe('matchSubcategory / matchSubSubcategory', () => {
  it('matches an existing subcategory by name under its parent', () => {
    expect(matchSubcategory('Gear', 'babies', categories)?.slug).toBe('gear');
  });

  it('matches the parent-prefixed slug the Manage Categories page generates', () => {
    expect(matchSubcategory('gear', 'babies', categories)?.slug).toBe('gear');
  });

  it('does not match a subcategory that belongs to a different category', () => {
    expect(matchSubcategory('Gear', 'mens-clothing', categories)).toBeUndefined();
  });

  it('matches an existing sub-subcategory under its parent subcategory', () => {
    expect(matchSubSubcategory('Monitors', 'gear', categories)?.slug).toBe('gear-monitors');
  });

  it('matches the prefixed sub-subcategory slug', () => {
    expect(matchSubSubcategory('gear-monitors', 'gear', categories)?.slug).toBe('gear-monitors');
  });
});

describe('suggestCategory / suggestSubcategory / suggestSubSubcategory', () => {
  it('suggests the closest category name for a loose match', () => {
    expect(suggestCategory('Baby', categories)?.slug).toBe('babies');
  });

  it('suggests nothing when nothing is close enough', () => {
    expect(suggestCategory('Electronics', categories)).toBeUndefined();
  });

  it('suggests the closest subcategory under its parent', () => {
    expect(suggestSubcategory('Gears', 'babies', categories)?.slug).toBe('gear');
  });

  it('suggests the closest sub-subcategory under its parent subcategory', () => {
    expect(suggestSubSubcategory('Monitor', 'gear', categories)?.slug).toBe('gear-monitors');
  });
});

describe('suggestCategorySplit', () => {
  it('recognises a category name immediately followed by a real subcategory name', () => {
    const split = suggestCategorySplit('Baby Gear', categories);
    expect(split?.category.slug).toBe('babies');
    expect(split?.subcategory.slug).toBe('gear');
  });

  it('is case-insensitive and tolerant of the exact spacing', () => {
    const split = suggestCategorySplit('BABIES  GEAR', categories);
    expect(split?.subcategory.slug).toBe('gear');
  });

  it('does not suggest a split when the raw text is only the category name', () => {
    expect(suggestCategorySplit('Babies', categories)).toBeUndefined();
  });

  it('does not suggest a split when the remainder matches no subcategory', () => {
    expect(suggestCategorySplit('Baby Furniture', categories)).toBeUndefined();
  });

  it('does not suggest a split for text unrelated to any category', () => {
    expect(suggestCategorySplit('Electronics Gear', categories)).toBeUndefined();
  });
});

describe('extractCategoryTerms', () => {
  const mapping = { category: 0, sub_category: 1, sub_sub_category: 2 };

  it('collects distinct category cells and (category, sub-category) pairs', () => {
    const rows = [
      { cells: ['Babies', 'Gear', ''] },
      { cells: ['Babies', 'Gear', ''] }, // duplicate row, should not double up
      { cells: ['Babies', 'Clothing', ''] },
    ];

    const { categories: terms, pairs } = extractCategoryTerms(rows, mapping);
    expect(terms).toEqual(['Babies']);
    expect(pairs).toEqual([
      { category: 'Babies', subCategory: 'Gear' },
      { category: 'Babies', subCategory: 'Clothing' },
    ]);
  });

  it('collects (category, sub-category, sub-subcategory) triples only when all three cells are filled', () => {
    const rows = [
      { cells: ['Babies', 'Gear', 'Monitors'] },
      { cells: ['Babies', 'Gear', ''] }, // no sub-subcategory cell — not a triple
      { cells: ['Babies', '', 'Ignored'] }, // no sub-category cell — not a triple either
    ];

    const { triples } = extractCategoryTerms(rows, mapping);
    expect(triples).toEqual([{ category: 'Babies', subCategory: 'Gear', subSubCategory: 'Monitors' }]);
  });

  it('returns nothing when the category column is not mapped', () => {
    expect(extractCategoryTerms([{ cells: ['Babies'] }], {})).toEqual({ categories: [], pairs: [], triples: [] });
  });
});

describe('resolving with overrides', () => {
  it('passes raw text through unchanged when there is no override and no exact match', () => {
    expect(resolveCategoryValue('Toys', categories)).toBe('Toys');
  });

  it('resolves a category through its override even without an exact match', () => {
    const overrides: CategoryOverrides = {
      categories: { toys: 'babies' },
      categorySplits: {},
      subCategories: {},
      subSubCategories: {},
    };
    expect(resolveCategoryValue('Toys', categories, overrides)).toBe('babies');
  });

  it('resolves an exact category match on its own, with no override at all', () => {
    // This is the guarantee that matters: a plain "Babies" against a
    // category literally named Babies must resolve to its slug even if the
    // client never got around to filling that into overrides.
    expect(resolveCategoryValue('Babies', categories)).toBe('babies');
    expect(resolveCategoryValue('Babies', categories, undefined)).toBe('babies');
  });

  it('prefers an explicit override over the exact match when both exist', () => {
    const overrides: CategoryOverrides = {
      categories: { babies: 'mens-clothing' },
      categorySplits: {},
      subCategories: {},
      subSubCategories: {},
    };
    expect(resolveCategoryValue('Babies', categories, overrides)).toBe('mens-clothing');
  });

  it('resolves a sub-category scoped to its resolved parent', () => {
    const overrides: CategoryOverrides = {
      categories: {},
      categorySplits: {},
      subCategories: { [subCategoryOverrideKey('babies', 'Gears')]: 'gear' },
      subSubCategories: {},
    };
    expect(resolveSubCategoryValue('babies', 'Gears', categories, overrides)).toBe('gear');
    // A different parent's identical raw text is a different key entirely.
    expect(resolveSubCategoryValue('mens-clothing', 'Gears', categories, overrides)).toBe('Gears');
  });

  it('resolves an exact sub-category match on its own, with no override', () => {
    expect(resolveSubCategoryValue('babies', 'Gear', categories)).toBe('gear');
  });

  it('resolves a sub-subcategory scoped to its resolved parent subcategory', () => {
    const overrides: CategoryOverrides = {
      categories: {},
      categorySplits: {},
      subCategories: {},
      subSubCategories: { [subSubCategoryOverrideKey('gear', 'Monitor')]: 'gear-monitors' },
    };
    expect(resolveSubSubCategoryValue('gear', 'Monitor', categories, overrides)).toBe('gear-monitors');
  });

  it('resolves an exact sub-subcategory match on its own, with no override', () => {
    expect(resolveSubSubCategoryValue('gear', 'Monitors', categories)).toBe('gear-monitors');
  });

  it('exposes a confirmed category split', () => {
    const overrides: CategoryOverrides = {
      categories: { 'baby gear': 'babies' },
      categorySplits: { 'baby gear': 'gear' },
      subCategories: {},
      subSubCategories: {},
    };
    expect(resolveCategorySplit('Baby Gear', overrides)).toBe('gear');
    expect(resolveCategorySplit('Babies', overrides)).toBeUndefined();
  });
});
