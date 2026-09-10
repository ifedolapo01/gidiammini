/**
 * COMMERCE layer — matching an import file's free-text category/sub-category/
 * sub-subcategory cells against the categories that actually exist.
 *
 * A CSV says "Men's Wear"; the database has a category whose slug is
 * `mens-clothing`. Nothing about that string similarity is guessable from the
 * column mapping step, and writing the raw text straight into
 * `products.category` (the old behaviour) produces a product the admin edit
 * form can never show a category for — its <select> only recognises a real
 * slug. This is the layer that finds "closest existing match" candidates so
 * the import wizard can ask the operator to confirm one, or create a new
 * category/subcategory instead, rather than silently writing text that maps
 * to nothing.
 *
 * One further wrinkle this file resolves: a file with only two category
 * columns can still describe three levels. `category: "Baby Gear"` is really
 * two existing levels squashed into one cell (Babies + Gear), and whatever
 * that file's own sub-category column says ("Monitors") is a third level
 * underneath Gear, not a sibling of it. suggestCategorySplit() is what
 * notices that "Baby Gear" is a category name immediately followed by a real
 * subcategory name — it is only ever a suggestion the resolver screen shows
 * for confirmation, never applied on its own.
 */
import { slugify } from './format-text';
import type { Category, Subcategory, SubSubcategory } from '@/types/product';
import type { ColumnMapping } from './product-import-fields';

/** Case/whitespace-insensitive key for comparing or grouping raw cell text. */
export function normaliseCategoryText(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Key for a subcategory override: scoped to the resolved parent category, so
 *  the same sub-category text under two different categories resolves
 *  independently. */
export function subCategoryOverrideKey(categorySlug: string, rawSubCategory: string): string {
  return `${categorySlug}::${normaliseCategoryText(rawSubCategory)}`;
}

/** Same idea, one level down: a sub-subcategory override is scoped to its
 *  resolved parent subcategory. */
export function subSubCategoryOverrideKey(subcategorySlug: string, rawSubSubCategory: string): string {
  return `${subcategorySlug}::${normaliseCategoryText(rawSubSubCategory)}`;
}

export interface CategorySubCategoryPair {
  category: string;
  subCategory: string;
}

export interface SubCategorySubSubCategoryPair {
  /** The resolved (or about-to-be-resolved) parent subcategory's raw category
   *  text and raw sub-category text — carried along only so the resolver can
   *  show "under Babies > Gear" without re-deriving it. */
  category: string;
  subCategory: string;
  subSubCategory: string;
}

/** Every distinct category cell, every distinct (category, sub-category)
 *  pair, and every distinct (category, sub-category, sub-subcategory) triple
 *  that this file's mapped columns actually contain. Blank cells are
 *  dropped — they fall back to a default elsewhere and need no resolving. */
export function extractCategoryTerms(
  rows: Array<{ cells: string[] }>,
  mapping: ColumnMapping
): {
  categories: string[];
  pairs: CategorySubCategoryPair[];
  triples: SubCategorySubSubCategoryPair[];
} {
  const categoryIndex = mapping.category;
  const subCategoryIndex = mapping.sub_category;
  const subSubCategoryIndex = mapping.sub_sub_category;

  const categories = new Set<string>();
  const pairs = new Map<string, CategorySubCategoryPair>();
  const triples = new Map<string, SubCategorySubSubCategoryPair>();

  if (typeof categoryIndex !== 'number') return { categories: [], pairs: [], triples: [] };

  for (const { cells } of rows) {
    const category = (cells[categoryIndex] ?? '').trim();
    if (!category) continue;
    categories.add(category);

    const subCategory = typeof subCategoryIndex === 'number' ? (cells[subCategoryIndex] ?? '').trim() : '';
    if (subCategory) {
      const key = subCategoryOverrideKey(normaliseCategoryText(category), subCategory);
      pairs.set(key, { category, subCategory });
    }

    if (subCategory && typeof subSubCategoryIndex === 'number') {
      const subSubCategory = (cells[subSubCategoryIndex] ?? '').trim();
      if (subSubCategory) {
        const key = `${normaliseCategoryText(category)}::${normaliseCategoryText(subCategory)}::${normaliseCategoryText(subSubCategory)}`;
        triples.set(key, { category, subCategory, subSubCategory });
      }
    }
  }

  return { categories: [...categories], pairs: [...pairs.values()], triples: [...triples.values()] };
}

/** An existing category this raw text already means, if any — by slug (the
 *  file exported a slug already) or by name (the common case, a person typed
 *  or exported a display name). */
export function matchCategory(raw: string, categories: Category[]): Category | undefined {
  const normalised = normaliseCategoryText(raw);
  const asSlug = slugify(raw);
  return categories.find(
    (cat) => cat.slug === asSlug || cat.slug.toLowerCase() === normalised || cat.name.trim().toLowerCase() === normalised
  );
}

/** Same idea, scoped to one category's children. Also matches the
 *  `${parentSlug}-${slug}` shape the "Manage categories" page generates, so a
 *  re-imported export always resolves without asking. */
export function matchSubcategory(
  raw: string,
  parentSlug: string,
  categories: Category[]
): Subcategory | undefined {
  const parent = categories.find((cat) => cat.slug === parentSlug);
  if (!parent) return undefined;

  const normalised = normaliseCategoryText(raw);
  const asSlug = slugify(raw);
  const prefixedSlug = `${parentSlug}-${asSlug}`;

  return parent.subcategories.find(
    (sub) =>
      sub.slug === asSlug ||
      sub.slug === prefixedSlug ||
      sub.slug.toLowerCase() === normalised ||
      sub.name.trim().toLowerCase() === normalised
  );
}

/** Same idea, one level further down: scoped to one subcategory's children. */
export function matchSubSubcategory(
  raw: string,
  parentSubcategorySlug: string,
  categories: Category[]
): SubSubcategory | undefined {
  const parent = categories.flatMap((cat) => cat.subcategories).find((sub) => sub.slug === parentSubcategorySlug);
  if (!parent) return undefined;

  const normalised = normaliseCategoryText(raw);
  const asSlug = slugify(raw);
  const prefixedSlug = `${parentSubcategorySlug}-${asSlug}`;

  return parent.subsubcategories.find(
    (subSub) =>
      subSub.slug === asSlug ||
      subSub.slug === prefixedSlug ||
      subSub.slug.toLowerCase() === normalised ||
      subSub.name.trim().toLowerCase() === normalised
  );
}

/** A loose name-similarity score, shared by every suggestXxx below — the
 *  starting point a resolver row pre-fills, never applied without
 *  confirmation. */
function nameScore(name: string, normalisedRaw: string): number {
  if (!name) return 0;
  if (name === normalisedRaw) return 100;
  if (name.startsWith(normalisedRaw) || normalisedRaw.startsWith(name)) return 70;
  if (name.includes(normalisedRaw) || normalisedRaw.includes(name)) return 50;
  // A single-word name/raw pair that shares its first few letters — the
  // fallback that catches "Baby" against a category named "Babies", where
  // English pluralisation means neither is literally a prefix of the other.
  if (!name.includes(' ') && !normalisedRaw.includes(' ') && sameWordLoosely(name, normalisedRaw)) return 60;
  return 0;
}

/** A loose "closest existing category" guess for pre-selecting the resolver's
 *  dropdown — a starting point the operator can override, not a decision. */
export function suggestCategory(raw: string, categories: Category[]): Category | undefined {
  const normalised = normaliseCategoryText(raw);
  if (!normalised) return undefined;

  let best: Category | undefined;
  let bestScore = 0;

  for (const cat of categories) {
    const score = nameScore(cat.name.trim().toLowerCase(), normalised);
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }

  return bestScore >= 50 ? best : undefined;
}

export function suggestSubcategory(
  raw: string,
  parentSlug: string,
  categories: Category[]
): Subcategory | undefined {
  const parent = categories.find((cat) => cat.slug === parentSlug);
  if (!parent) return undefined;

  const normalised = normaliseCategoryText(raw);
  if (!normalised) return undefined;

  let best: Subcategory | undefined;
  let bestScore = 0;

  for (const sub of parent.subcategories) {
    const score = nameScore(sub.name.trim().toLowerCase(), normalised);
    if (score > bestScore) {
      bestScore = score;
      best = sub;
    }
  }

  return bestScore >= 50 ? best : undefined;
}

export function suggestSubSubcategory(
  raw: string,
  parentSubcategorySlug: string,
  categories: Category[]
): SubSubcategory | undefined {
  const parent = categories.flatMap((cat) => cat.subcategories).find((sub) => sub.slug === parentSubcategorySlug);
  if (!parent) return undefined;

  const normalised = normaliseCategoryText(raw);
  if (!normalised) return undefined;

  let best: SubSubcategory | undefined;
  let bestScore = 0;

  for (const subSub of parent.subsubcategories) {
    const score = nameScore(subSub.name.trim().toLowerCase(), normalised);
    if (score > bestScore) {
      bestScore = score;
      best = subSub;
    }
  }

  return bestScore >= 50 ? best : undefined;
}

/**
 * Two words are "the same word" for this purpose if they share enough of
 * their start — a cheap stand-in for a real stemmer, and enough to treat
 * "Baby"/"Babies" or "Box"/"Boxes" as the same word without a pluralisation
 * table. A literal `startsWith` would miss "Babies" against "Baby Gear"
 * entirely, since English pluralisation is not always just appending a
 * letter (baby -> babies, not babys).
 */
function sameWordLoosely(a: string, b: string): boolean {
  if (a === b) return true;
  const prefixLen = Math.min(3, a.length, b.length);
  return prefixLen > 0 && a.slice(0, prefixLen) === b.slice(0, prefixLen);
}

/**
 * "Baby Gear" is a category name ("Babies") immediately followed by a real
 * subcategory name ("Gear") — two existing levels squashed into one cell.
 * Tries every category whose name's words loosely match the raw text's
 * leading words, and checks whether what is left over names one of its
 * subcategories (exactly, or closely enough to suggest). Only ever a
 * suggestion: the resolver screen shows it beside "pick an existing
 * category" and "create a new one", and nothing is applied until the
 * operator confirms it.
 */
export function suggestCategorySplit(
  raw: string,
  categories: Category[]
): { category: Category; subcategory: Subcategory } | undefined {
  const normalised = normaliseCategoryText(raw);
  if (!normalised) return undefined;

  const words = normalised.split(/\s+/).filter(Boolean);
  if (words.length < 2) return undefined; // No room for both a category and a subcategory word.

  for (const cat of categories) {
    const catWords = cat.name.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (catWords.length === 0 || catWords.length >= words.length) continue;

    const leadingWordsMatch = catWords.every((catWord, i) => sameWordLoosely(catWord, words[i]));
    if (!leadingWordsMatch) continue;

    const remainder = words.slice(catWords.length).join(' ');
    if (!remainder) continue;

    const subcategory = matchSubcategory(remainder, cat.slug, categories) ?? suggestSubcategory(remainder, cat.slug, categories);
    if (subcategory) return { category: cat, subcategory };
  }

  return undefined;
}

/**
 * Overrides the import wizard sends alongside the column mapping: raw text
 * the file used, resolved to real category/sub-category/sub-subcategory
 * slugs. Applied identically for the preview and the commit — same reason
 * the mapping is.
 */
export interface CategoryOverrides {
  /** Normalised raw category text -> resolved category slug. */
  categories: Record<string, string>;
  /**
   * Normalised raw category text -> resolved subcategory slug, present only
   * when that text was confirmed as a split ("Baby Gear" -> Babies + Gear).
   * When set, the file's own sub-category cell for that row names a
   * sub-subcategory of this subcategory, not a sibling subcategory of the
   * resolved category.
   */
  categorySplits: Record<string, string>;
  /** `${resolvedCategorySlug}::${normalised raw sub-category text}` -> resolved sub-category slug. */
  subCategories: Record<string, string>;
  /** `${resolvedSubcategorySlug}::${normalised raw sub-subcategory text}` -> resolved sub-subcategory slug. */
  subSubCategories: Record<string, string>;
}

/**
 * The slug this raw category text should be written as.
 *
 * Checks the operator's override first, but does not stop there: an exact
 * match ("Babies" against a category literally named Babies) is resolved
 * here too, independently of whether the client ever got around to filling
 * it into `overrides` — the wizard's own silent auto-fill runs on a
 * `useEffect` and asks the operator for nothing in this case, so this is the
 * one guarantee that a plain, unambiguous match is never written as raw text
 * merely because a client-side effect hadn't committed yet. Only a genuine
 * ambiguity (no exact match, no override) falls through to the raw text.
 */
export function resolveCategoryValue(raw: string, categories: Category[], overrides?: CategoryOverrides): string {
  const overrideSlug = overrides?.categories[normaliseCategoryText(raw)];
  if (overrideSlug) return overrideSlug;
  return matchCategory(raw, categories)?.slug ?? raw;
}

/** The subcategory a confirmed split resolved the category cell's text to,
 *  if any. Splits are a suggestion an operator must actively confirm, so —
 *  unlike resolveCategoryValue — this never falls back to a guess. */
export function resolveCategorySplit(raw: string, overrides?: CategoryOverrides): string | undefined {
  return overrides?.categorySplits[normaliseCategoryText(raw)];
}

export function resolveSubCategoryValue(
  resolvedCategorySlug: string,
  raw: string,
  categories: Category[],
  overrides?: CategoryOverrides
): string {
  const overrideSlug = overrides?.subCategories[subCategoryOverrideKey(resolvedCategorySlug, raw)];
  if (overrideSlug) return overrideSlug;
  return matchSubcategory(raw, resolvedCategorySlug, categories)?.slug ?? raw;
}

export function resolveSubSubCategoryValue(
  resolvedSubcategorySlug: string,
  raw: string,
  categories: Category[],
  overrides?: CategoryOverrides
): string {
  const overrideSlug = overrides?.subSubCategories[subSubCategoryOverrideKey(resolvedSubcategorySlug, raw)];
  if (overrideSlug) return overrideSlug;
  return matchSubSubcategory(raw, resolvedSubcategorySlug, categories)?.slug ?? raw;
}
