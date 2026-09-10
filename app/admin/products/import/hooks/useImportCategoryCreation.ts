/** ADMIN layer — "create new category/subcategory/sub-subcategory" inline
 *  from the import wizard's category-resolution step.
 *
 * Writes through the same /api/admin/categories, /api/admin/subcategories and
 * /api/admin/subsubcategories routes the "Manage categories" page uses, so a
 * category created mid-import is identical to one created there — no second
 * definition of what a valid category is. Deliberately a modal rather than a
 * navigation to that page: leaving the import would lose the file, the
 * mapping and every choice already made in this step.
 */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { slugify } from '@/lib/commerce/format-text';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

type CreationTarget =
  | { kind: 'category'; raw: string }
  | { kind: 'subcategory'; raw: string; categorySlug: string; categoryName: string }
  | { kind: 'subsubcategory'; raw: string; subcategorySlug: string; subcategoryName: string };

export function useImportCategoryCreation(onCreated: () => void) {
  const [target, setTarget] = useState<CreationTarget | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const slug = (() => {
    if (target?.kind === 'subcategory') return `${target.categorySlug}-${slugify(name)}`;
    if (target?.kind === 'subsubcategory') return `${target.subcategorySlug}-${slugify(name)}`;
    return slugify(name);
  })();

  const openForCategory = (raw: string) => {
    setTarget({ kind: 'category', raw });
    setName(raw);
  };

  const openForSubcategory = (raw: string, categorySlug: string, categoryName: string) => {
    setTarget({ kind: 'subcategory', raw, categorySlug, categoryName });
    setName(raw);
  };

  const openForSubSubcategory = (raw: string, subcategorySlug: string, subcategoryName: string) => {
    setTarget({ kind: 'subsubcategory', raw, subcategorySlug, subcategoryName });
    setName(raw);
  };

  const close = () => {
    setTarget(null);
    setName('');
  };

  /** Creates whatever `target` currently is and returns the new slug, or null
   *  on failure — the caller uses the slug to resolve the raw text that
   *  prompted this, and never needs to know which endpoint was involved. */
  const submit = async (): Promise<string | null> => {
    if (!target || !name.trim() || !slug) return null;

    setBusy(true);
    try {
      if (target.kind === 'category') {
        const res = await adminFetch('/api/admin/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug }),
        });
        const data = await res.json();
        if (!data.success) {
          toast.error(data.error || 'Failed to create category');
          return null;
        }
        onCreated();
        return data.category.slug as string;
      }

      if (target.kind === 'subcategory') {
        const res = await adminFetch('/api/admin/subcategories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, category_slug: target.categorySlug }),
        });
        const data = await res.json();
        if (!data.success) {
          toast.error(data.error || 'Failed to create subcategory');
          return null;
        }
        onCreated();
        return data.subcategory.slug as string;
      }

      const res = await adminFetch('/api/admin/subsubcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, subcategory_slug: target.subcategorySlug }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to create sub-subcategory');
        return null;
      }
      onCreated();
      return data.subsubcategory.slug as string;
    } catch {
      toast.error('Network error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  return {
    target,
    name,
    setName,
    slug,
    busy,
    openForCategory,
    openForSubcategory,
    openForSubSubcategory,
    close,
    submit,
  };
}
