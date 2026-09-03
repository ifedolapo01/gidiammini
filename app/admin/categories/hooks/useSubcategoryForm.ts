/**
 * ADMIN layer hook — the "add a subcategory" form on the Manage Categories page.
 *
 * Split out of useCategories, which had grown past 200 lines and was three
 * concerns in one file: the category list, the category form, and this. They
 * share exactly one thing — the list has to be refetched after a write — so
 * that arrives as an argument and nothing else is entangled.
 *
 * Composed inside useCategories rather than called by the page, so the page's
 * single flat destructure is unchanged.
 */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { slugify } from '@/lib/commerce/format-text';

interface UseSubcategoryFormArgs {
  /** Refetches the category list after a write. */
  refresh: () => void;
  /** Shared with the category list so one row at a time shows as deleting. */
  setPendingDeleteId: (id: string | null) => void;
}

export function useSubcategoryForm({ refresh, setPendingDeleteId }: UseSubcategoryFormArgs) {
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState<string>('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubSlug, setNewSubSlug] = useState('');
  const [isAddingSub, setIsAddingSub] = useState(false);

  /** The slug is prefixed with the parent, which is why it is regenerated both
   *  when the name changes and when the parent does. */
  const handleSubNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewSubName(name);
    setNewSubSlug(selectedCategoryForSub ? `${selectedCategoryForSub}-${slugify(name)}` : slugify(name));
  };

  const handleParentCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategoryForSub(e.target.value);
    if (newSubName) {
      setNewSubSlug(`${e.target.value}-${slugify(newSubName)}`);
    }
  };

  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName || !newSubSlug || !selectedCategoryForSub) return;

    setIsAddingSub(true);
    try {
      const res = await fetch('/api/admin/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSubName,
          slug: newSubSlug,
          category_slug: selectedCategoryForSub
        })
      });
      const data = await res.json();

      if (data.success) {
        setNewSubName('');
        setNewSubSlug('');
        setSelectedCategoryForSub('');
        refresh();
      } else {
        toast.error(data.error || 'Failed to create subcategory');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsAddingSub(false);
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subcategory?')) return;

    setPendingDeleteId(id);
    try {
      const res = await fetch('/api/admin/subcategories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();

      if (data.success) {
        refresh();
      } else {
        toast.error(data.error || 'Failed to delete subcategory');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setPendingDeleteId(null);
    }
  };

  return {
    selectedCategoryForSub,
    newSubName,
    newSubSlug,
    isAddingSub,
    handleSubNameChange,
    handleParentCategoryChange,
    handleAddSubcategory,
    handleDeleteSubcategory,
  };
}
