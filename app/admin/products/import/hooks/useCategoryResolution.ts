/** ADMIN layer — resolving an import file's raw category/sub-category/
 *  sub-subcategory text against the categories that actually exist.
 *
 * Lives above the wizard's step state (instantiated once, unconditionally, in
 * the page) rather than inside the resolver screen itself: the screen only
 * mounts while `step === 'categories'`, and an admin who goes "Back to
 * columns" and forward again should not lose the choices they already made.
 *
 * Three tiers of match:
 *  - An exact match (same slug, or the same name) is applied automatically
 *    and never shown — a file this admin exported, where every category
 *    already matches, asks nothing.
 *  - A loose match ("Mens Wear" against a category named "Men's Clothing")
 *    is only ever a pre-filled suggestion. It stays on the review list and
 *    pre-selects the closest guess, but the operator can still pick a
 *    different one or create a new category — the whole reason this step
 *    exists is that a guess is not the same as a confirmed answer.
 *  - A category SPLIT ("Baby Gear" -> Babies + Gear) is offered only for a
 *    category cell that matched nothing on its own. When confirmed, the
 *    file's own sub-category cell for that row is reinterpreted one level
 *    down — a sub-subcategory of the split's subcategory, not a sibling
 *    subcategory of the resolved category.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Category } from '@/types/product';
import type { ColumnMapping, CategoryOverrides } from '@/lib/commerce/product-import';
import {
  extractCategoryTerms,
  matchCategory,
  matchSubcategory,
  matchSubSubcategory,
  normaliseCategoryText,
  subCategoryOverrideKey,
  subSubCategoryOverrideKey,
  suggestCategory,
  suggestCategorySplit,
  suggestSubcategory,
  suggestSubSubcategory,
} from '@/lib/commerce/product-import-categories';
import type { CsvTable } from '@/lib/commerce/csv-parse';

const EMPTY_OVERRIDES: CategoryOverrides = { categories: {}, categorySplits: {}, subCategories: {}, subSubCategories: {} };

export interface ReviewSubcategory {
  category: string;
  subCategory: string;
  resolvedCategorySlug: string;
}

export interface ReviewSubSubcategory {
  /** What to show as this row's parent trail — already resolved as far as
   *  it goes, e.g. "Babies > Gear" or "Babies > Gear (split from 'Baby Gear')". */
  parentLabel: string;
  /** The raw text that needs a sub-subcategory resolution. */
  raw: string;
  resolvedSubcategorySlug: string;
}

export function useCategoryResolution(
  rows: CsvTable['rows'],
  mapping: ColumnMapping,
  categories: Category[],
  loadingCategories: boolean
) {
  const [overrides, setOverrides] = useState<CategoryOverrides>(EMPTY_OVERRIDES);

  const { categories: categoryTerms, pairs, triples } = useMemo(
    () => extractCategoryTerms(rows, mapping),
    [rows, mapping]
  );

  // Never shown: resolved the instant the file and the category list are
  // both known, same as autoMapColumns resolves a column header nobody had
  // to touch.
  const reviewCategories = useMemo(
    () => (loadingCategories ? [] : categoryTerms.filter((raw) => !matchCategory(raw, categories))),
    [categoryTerms, categories, loadingCategories]
  );

  /** Every category name in the file that has no split applied — its pairs
   *  read the ordinary way. */
  const resolvedCategorySlugFor = (raw: string): string | undefined =>
    overrides.categories[normaliseCategoryText(raw)] ?? matchCategory(raw, categories)?.slug;

  const reviewSubcategories = useMemo<ReviewSubcategory[]>(() => {
    if (loadingCategories) return [];

    const results: ReviewSubcategory[] = [];
    for (const { category, subCategory } of pairs) {
      const categoryKey = normaliseCategoryText(category);
      if (overrides.categorySplits[categoryKey]) continue; // Read as a sub-subcategory instead — see reviewSubSubcategories.

      const resolvedCategorySlug = resolvedCategorySlugFor(category);
      if (!resolvedCategorySlug) continue; // its own category is still on reviewCategories

      if (!matchSubcategory(subCategory, resolvedCategorySlug, categories)) {
        results.push({ category, subCategory, resolvedCategorySlug });
      }
    }
    return results;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, overrides.categories, overrides.categorySplits, categories, loadingCategories]);

  const reviewSubSubcategories = useMemo<ReviewSubSubcategory[]>(() => {
    if (loadingCategories) return [];

    const results: ReviewSubSubcategory[] = [];

    // Split rows: the category cell already claimed the subcategory level, so
    // this row's own sub-category cell names a sub-subcategory of it.
    for (const { category, subCategory } of pairs) {
      const categoryKey = normaliseCategoryText(category);
      const splitSubcategorySlug = overrides.categorySplits[categoryKey];
      if (!splitSubcategorySlug) continue;

      if (!matchSubSubcategory(subCategory, splitSubcategorySlug, categories)) {
        const parent = categories.flatMap((cat) => cat.subcategories).find((sub) => sub.slug === splitSubcategorySlug);
        results.push({
          parentLabel: parent ? `${parent.name} (split from "${category}")` : category,
          raw: subCategory,
          resolvedSubcategorySlug: splitSubcategorySlug,
        });
      }
    }

    // Ordinary rows: a genuinely mapped sub_sub_category column, under a
    // category that was not split.
    for (const { category, subCategory, subSubCategory } of triples) {
      const categoryKey = normaliseCategoryText(category);
      if (overrides.categorySplits[categoryKey]) continue; // already covered above

      const resolvedCategorySlug = resolvedCategorySlugFor(category);
      if (!resolvedCategorySlug) continue;

      const resolvedSubcategorySlug =
        overrides.subCategories[subCategoryOverrideKey(resolvedCategorySlug, subCategory)] ??
        matchSubcategory(subCategory, resolvedCategorySlug, categories)?.slug;
      if (!resolvedSubcategorySlug) continue; // its own subcategory is still on reviewSubcategories

      if (!matchSubSubcategory(subSubCategory, resolvedSubcategorySlug, categories)) {
        const parent = categories.flatMap((cat) => cat.subcategories).find((sub) => sub.slug === resolvedSubcategorySlug);
        results.push({
          parentLabel: parent ? `${categories.find((c) => c.slug === resolvedCategorySlug)?.name ?? category} > ${parent.name}` : category,
          raw: subSubCategory,
          resolvedSubcategorySlug,
        });
      }
    }

    return results;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, triples, overrides, categories, loadingCategories]);

  /** For each unmatched category term, the closest existing category+subcategory
   *  split this raw text could be — offered as a distinct option in its row,
   *  never applied without the operator choosing it. */
  const categorySplitSuggestions = useMemo(() => {
    const map = new Map<string, { categorySlug: string; categoryName: string; subcategorySlug: string; subcategoryName: string }>();
    if (loadingCategories) return map;

    for (const raw of reviewCategories) {
      const key = normaliseCategoryText(raw);
      if (overrides.categorySplits[key]) continue; // already chosen

      const split = suggestCategorySplit(raw, categories);
      if (split) {
        map.set(raw, {
          categorySlug: split.category.slug,
          categoryName: split.category.name,
          subcategorySlug: split.subcategory.slug,
          subcategoryName: split.subcategory.name,
        });
      }
    }
    return map;
  }, [reviewCategories, overrides.categorySplits, categories, loadingCategories]);

  // Exact matches, applied silently. Guarded so this never overwrites a
  // choice the operator (or the suggestion pre-fill below) already made, and
  // returns the same object when nothing changed so it cannot loop.
  useEffect(() => {
    if (loadingCategories) return;

    setOverrides((current) => {
      let changed = false;
      const nextCategories = { ...current.categories };

      for (const raw of categoryTerms) {
        const key = normaliseCategoryText(raw);
        if (nextCategories[key]) continue;
        const match = matchCategory(raw, categories);
        if (match) {
          nextCategories[key] = match.slug;
          changed = true;
        }
      }

      const nextSubCategories = { ...current.subCategories };
      for (const { category, subCategory } of pairs) {
        const categoryKey = normaliseCategoryText(category);
        if (current.categorySplits[categoryKey]) continue;

        const resolvedCategorySlug = nextCategories[categoryKey] ?? matchCategory(category, categories)?.slug;
        if (!resolvedCategorySlug) continue;

        const subKey = subCategoryOverrideKey(resolvedCategorySlug, subCategory);
        if (nextSubCategories[subKey]) continue;

        const match = matchSubcategory(subCategory, resolvedCategorySlug, categories);
        if (match) {
          nextSubCategories[subKey] = match.slug;
          changed = true;
        }
      }

      const nextSubSubCategories = { ...current.subSubCategories };
      for (const { category, subCategory, subSubCategory } of triples) {
        const categoryKey = normaliseCategoryText(category);
        if (current.categorySplits[categoryKey]) continue;

        const resolvedCategorySlug = nextCategories[categoryKey] ?? matchCategory(category, categories)?.slug;
        if (!resolvedCategorySlug) continue;

        const resolvedSubcategorySlug =
          nextSubCategories[subCategoryOverrideKey(resolvedCategorySlug, subCategory)] ??
          matchSubcategory(subCategory, resolvedCategorySlug, categories)?.slug;
        if (!resolvedSubcategorySlug) continue;

        const subSubKey = subSubCategoryOverrideKey(resolvedSubcategorySlug, subSubCategory);
        if (nextSubSubCategories[subSubKey]) continue;

        const match = matchSubSubcategory(subSubCategory, resolvedSubcategorySlug, categories);
        if (match) {
          nextSubSubCategories[subSubKey] = match.slug;
          changed = true;
        }
      }

      return changed
        ? { ...current, categories: nextCategories, subCategories: nextSubCategories, subSubCategories: nextSubSubCategories }
        : current;
    });
  }, [categoryTerms, pairs, triples, categories, loadingCategories]);

  // Loose matches, pre-filled but left on the review list. Runs once per new
  // term (deps exclude `overrides`), so a suggestion the operator clears back
  // to blank stays blank rather than snapping back.
  useEffect(() => {
    if (reviewCategories.length === 0 && reviewSubcategories.length === 0 && reviewSubSubcategories.length === 0) return;

    setOverrides((current) => {
      let changed = false;
      const nextCategories = { ...current.categories };

      for (const raw of reviewCategories) {
        const key = normaliseCategoryText(raw);
        if (nextCategories[key]) continue;
        const suggestion = suggestCategory(raw, categories);
        if (suggestion) {
          nextCategories[key] = suggestion.slug;
          changed = true;
        }
      }

      const nextSubCategories = { ...current.subCategories };
      for (const { subCategory, resolvedCategorySlug } of reviewSubcategories) {
        const subKey = subCategoryOverrideKey(resolvedCategorySlug, subCategory);
        if (nextSubCategories[subKey]) continue;
        const suggestion = suggestSubcategory(subCategory, resolvedCategorySlug, categories);
        if (suggestion) {
          nextSubCategories[subKey] = suggestion.slug;
          changed = true;
        }
      }

      const nextSubSubCategories = { ...current.subSubCategories };
      for (const { raw, resolvedSubcategorySlug } of reviewSubSubcategories) {
        const subSubKey = subSubCategoryOverrideKey(resolvedSubcategorySlug, raw);
        if (nextSubSubCategories[subSubKey]) continue;
        const suggestion = suggestSubSubcategory(raw, resolvedSubcategorySlug, categories);
        if (suggestion) {
          nextSubSubCategories[subSubKey] = suggestion.slug;
          changed = true;
        }
      }

      return changed
        ? { ...current, categories: nextCategories, subCategories: nextSubCategories, subSubCategories: nextSubSubCategories }
        : current;
    });
  }, [reviewCategories, reviewSubcategories, reviewSubSubcategories, categories]);

  const setCategoryOverride = (raw: string, slug: string) => {
    const key = normaliseCategoryText(raw);
    setOverrides((current) => {
      // Picking a category outright supersedes any split this term had.
      const { [key]: _dropped, ...restSplits } = current.categorySplits;
      return { ...current, categories: { ...current.categories, [key]: slug }, categorySplits: restSplits };
    });
  };

  const setCategorySplitOverride = (raw: string, categorySlug: string, subcategorySlug: string) => {
    const key = normaliseCategoryText(raw);
    setOverrides((current) => ({
      ...current,
      categories: { ...current.categories, [key]: categorySlug },
      categorySplits: { ...current.categorySplits, [key]: subcategorySlug },
    }));
  };

  const setSubCategoryOverride = (resolvedCategorySlug: string, raw: string, slug: string) => {
    setOverrides((current) => ({
      ...current,
      subCategories: { ...current.subCategories, [subCategoryOverrideKey(resolvedCategorySlug, raw)]: slug },
    }));
  };

  const setSubSubCategoryOverride = (resolvedSubcategorySlug: string, raw: string, slug: string) => {
    setOverrides((current) => ({
      ...current,
      subSubCategories: { ...current.subSubCategories, [subSubCategoryOverrideKey(resolvedSubcategorySlug, raw)]: slug },
    }));
  };

  const reset = () => setOverrides(EMPTY_OVERRIDES);

  const hasUnresolved =
    reviewCategories.some((raw) => !overrides.categories[normaliseCategoryText(raw)]) ||
    reviewSubcategories.some(
      ({ subCategory, resolvedCategorySlug }) =>
        !overrides.subCategories[subCategoryOverrideKey(resolvedCategorySlug, subCategory)]
    ) ||
    reviewSubSubcategories.some(
      ({ raw, resolvedSubcategorySlug }) =>
        !overrides.subSubCategories[subSubCategoryOverrideKey(resolvedSubcategorySlug, raw)]
    );

  return {
    overrides,
    reviewCategories,
    reviewSubcategories,
    reviewSubSubcategories,
    categorySplitSuggestions,
    hasUnresolved,
    setCategoryOverride,
    setCategorySplitOverride,
    setSubCategoryOverride,
    setSubSubCategoryOverride,
    reset,
  };
}
