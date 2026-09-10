/** ADMIN layer — step three: what this file calls a category, matched to
 *  what the storefront actually has.
 *
 * Only reached when the file contains text useCategoryResolution could not
 * line up exactly with an existing category, sub-category or sub-subcategory.
 * Every row here pre-selects the closest guess, but is a real decision:
 * confirm it, pick a different existing one, or create a new one on the spot.
 * A category row may additionally offer a SPLIT — "Baby Gear" recognised as
 * Babies + Gear — when that reading exists; choosing it changes what this
 * row's own sub-category cell is understood to mean, so it is never applied
 * on its own. Nothing here writes a product — the same dry-run guarantee the
 * preview step makes holds for this one too.
 */
'use client';

import { Plus, Split } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import type { Category } from '@/types/product';
import type { ReviewSubcategory, ReviewSubSubcategory } from '../hooks/useCategoryResolution';
import { useImportCategoryCreation } from '../hooks/useImportCategoryCreation';
import { normaliseCategoryText, subCategoryOverrideKey, subSubCategoryOverrideKey, type CategoryOverrides } from '@/lib/commerce/product-import-categories';

interface ImportCategoryResolverProps {
  categories: Category[];
  loadingCategories: boolean;
  overrides: CategoryOverrides;
  reviewCategories: string[];
  reviewSubcategories: ReviewSubcategory[];
  reviewSubSubcategories: ReviewSubSubcategory[];
  categorySplitSuggestions: Map<
    string,
    { categorySlug: string; categoryName: string; subcategorySlug: string; subcategoryName: string }
  >;
  onSetCategoryOverride: (raw: string, slug: string) => void;
  onSetCategorySplitOverride: (raw: string, categorySlug: string, subcategorySlug: string) => void;
  onSetSubCategoryOverride: (resolvedCategorySlug: string, raw: string, slug: string) => void;
  onSetSubSubCategoryOverride: (resolvedSubcategorySlug: string, raw: string, slug: string) => void;
  onCategoriesChanged: () => void;
}

export function ImportCategoryResolver({
  categories,
  loadingCategories,
  overrides,
  reviewCategories,
  reviewSubcategories,
  reviewSubSubcategories,
  categorySplitSuggestions,
  onSetCategoryOverride,
  onSetCategorySplitOverride,
  onSetSubCategoryOverride,
  onSetSubSubCategoryOverride,
  onCategoriesChanged,
}: ImportCategoryResolverProps) {
  const creation = useImportCategoryCreation(onCategoriesChanged);

  const handleCreate = async () => {
    const slug = await creation.submit();
    if (!slug || !creation.target) return;

    if (creation.target.kind === 'category') {
      onSetCategoryOverride(creation.target.raw, slug);
    } else if (creation.target.kind === 'subcategory') {
      onSetSubCategoryOverride(creation.target.categorySlug, creation.target.raw, slug);
    } else {
      onSetSubSubCategoryOverride(creation.target.subcategorySlug, creation.target.raw, slug);
    }
    creation.close();
  };

  if (loadingCategories) {
    return <p className="text-body-sm text-text-secondary">Loading your categories…</p>;
  }

  return (
    <div className="space-y-8">
      {reviewCategories.length > 0 && (
        <section>
          <h2 className="text-h6 font-semibold text-text-primary">Categories we don&apos;t recognise</h2>
          <p className="mt-1 text-body-sm text-text-secondary">
            Your file uses these, but nothing on the storefront matches them exactly. Confirm the
            closest existing category, use a suggested split, or create a new one.
          </p>

          <div className="mt-4 space-y-3">
            {reviewCategories.map((raw) => {
              const value = overrides.categories[normaliseCategoryText(raw)] ?? '';
              const split = categorySplitSuggestions.get(raw);
              const splitChosen = !!overrides.categorySplits[normaliseCategoryText(raw)];

              return (
                <div key={raw} className="space-y-2 rounded-surface border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-text-primary" title={raw}>
                      “{raw}”
                    </span>
                    <Select
                      size="sm"
                      className="w-full max-w-xs"
                      invalid={!value}
                      value={value}
                      onChange={(event) => onSetCategoryOverride(raw, event.target.value)}
                    >
                      <option value="">Pick the closest category…</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.slug}>
                          {cat.name}
                        </option>
                      ))}
                    </Select>
                    <Button type="button" variant="outline" size="sm" onClick={() => creation.openForCategory(raw)}>
                      <Plus className="size-4" aria-hidden="true" />
                      Create category
                    </Button>
                  </div>

                  {split && (
                    <div className="flex flex-wrap items-center gap-2 rounded-control bg-primary/5 px-3 py-2">
                      <Split className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-body-sm text-text-secondary">
                        Looks like <span className="font-medium text-text-primary">{split.categoryName} &gt; {split.subcategoryName}</span> —
                        the sub-category cell on these rows would then be read as a level under {split.subcategoryName}.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={splitChosen ? 'secondary' : 'outline'}
                        onClick={() => onSetCategorySplitOverride(raw, split.categorySlug, split.subcategorySlug)}
                      >
                        {splitChosen ? 'Split applied' : 'Use this split'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {reviewSubcategories.length > 0 && (
        <section>
          <h2 className="text-h6 font-semibold text-text-primary">Sub-categories we don&apos;t recognise</h2>
          <p className="mt-1 text-body-sm text-text-secondary">
            Same idea, one level down — these don&apos;t match a sub-category under their resolved
            category exactly.
          </p>

          <div className="mt-4 space-y-3">
            {reviewSubcategories.map(({ category, subCategory, resolvedCategorySlug }) => {
              const parent = categories.find((cat) => cat.slug === resolvedCategorySlug);
              const value = overrides.subCategories[subCategoryOverrideKey(resolvedCategorySlug, subCategory)] ?? '';
              const key = `${resolvedCategorySlug}::${subCategory}`;

              return (
                <div key={key} className="flex flex-wrap items-center gap-3 rounded-surface border border-border bg-surface p-4">
                  <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-text-primary" title={subCategory}>
                    “{subCategory}” <span className="font-normal text-text-secondary">under {parent?.name ?? category}</span>
                  </span>
                  <Select
                    size="sm"
                    className="w-full max-w-xs"
                    invalid={!value}
                    value={value}
                    onChange={(event) => onSetSubCategoryOverride(resolvedCategorySlug, subCategory, event.target.value)}
                  >
                    <option value="">Pick the closest sub-category…</option>
                    {(parent?.subcategories ?? []).map((sub) => (
                      <option key={sub.id} value={sub.slug}>
                        {sub.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => creation.openForSubcategory(subCategory, resolvedCategorySlug, parent?.name ?? category)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Create sub-category
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {reviewSubSubcategories.length > 0 && (
        <section>
          <h2 className="text-h6 font-semibold text-text-primary">Sub-subcategories we don&apos;t recognise</h2>
          <p className="mt-1 text-body-sm text-text-secondary">
            One level further down — these don&apos;t match a sub-subcategory under their resolved
            sub-category exactly.
          </p>

          <div className="mt-4 space-y-3">
            {reviewSubSubcategories.map(({ parentLabel, raw, resolvedSubcategorySlug }) => {
              const parent = categories.flatMap((cat) => cat.subcategories).find((sub) => sub.slug === resolvedSubcategorySlug);
              const value = overrides.subSubCategories[subSubCategoryOverrideKey(resolvedSubcategorySlug, raw)] ?? '';
              const key = `${resolvedSubcategorySlug}::${raw}`;

              return (
                <div key={key} className="flex flex-wrap items-center gap-3 rounded-surface border border-border bg-surface p-4">
                  <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-text-primary" title={raw}>
                    “{raw}” <span className="font-normal text-text-secondary">under {parentLabel}</span>
                  </span>
                  <Select
                    size="sm"
                    className="w-full max-w-xs"
                    invalid={!value}
                    value={value}
                    onChange={(event) => onSetSubSubCategoryOverride(resolvedSubcategorySlug, raw, event.target.value)}
                  >
                    <option value="">Pick the closest sub-subcategory…</option>
                    {(parent?.subsubcategories ?? []).map((subSub) => (
                      <option key={subSub.id} value={subSub.slug}>
                        {subSub.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => creation.openForSubSubcategory(raw, resolvedSubcategorySlug, parent?.name ?? parentLabel)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Create sub-subcategory
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <Modal
        open={!!creation.target}
        onClose={creation.close}
        title={
          creation.target?.kind === 'subsubcategory'
            ? 'Create sub-subcategory'
            : creation.target?.kind === 'subcategory'
              ? 'Create sub-category'
              : 'Create category'
        }
        size="sm"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleCreate();
          }}
          className="space-y-4"
        >
          {creation.target?.kind === 'subcategory' && (
            <p className="text-body-sm text-text-secondary">
              Under <span className="font-medium text-text-primary">{creation.target.categoryName}</span>
            </p>
          )}
          {creation.target?.kind === 'subsubcategory' && (
            <p className="text-body-sm text-text-secondary">
              Under <span className="font-medium text-text-primary">{creation.target.subcategoryName}</span>
            </p>
          )}
          <div>
            <label className="mb-1 block text-body-sm font-medium text-text-primary">
              {creation.target?.kind === 'subsubcategory'
                ? 'Sub-subcategory name'
                : creation.target?.kind === 'subcategory'
                  ? 'Sub-category name'
                  : 'Category name'}
            </label>
            <Input value={creation.name} onChange={(event) => creation.setName(event.target.value)} required autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-body-sm font-medium text-text-primary">URL slug</label>
            <Input
              value={creation.slug}
              readOnly
              className="bg-background-secondary font-mono text-body-sm text-text-secondary"
            />
          </div>
          <Button type="submit" loading={creation.busy} disabled={creation.busy || !creation.name.trim()} className="w-full">
            <Plus className="size-4" aria-hidden="true" />
            {creation.target?.kind === 'subsubcategory'
              ? 'Create sub-subcategory'
              : creation.target?.kind === 'subcategory'
                ? 'Create sub-category'
                : 'Create category'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
