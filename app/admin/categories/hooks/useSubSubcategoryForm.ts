/**
 * ADMIN layer hook — the "add a sub-subcategory" form on the Manage Categories page.
 *
 * Mirrors useSubcategoryForm.ts one level down. The one difference: its parent
 * picker is two cascading selects (category, then that category's
 * subcategories) rather than one, because a subcategory slug alone does not
 * say which category's list to show it under — the same cascade
 * ProductInfoSection.tsx already uses for the product form's category fields.
 */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui';
import { slugify } from '@/lib/commerce/format-text';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

interface UseSubSubcategoryFormArgs {
  /** Refetches the category list after a write. */
  refresh: () => void;
  /** Shared with the category list so one row at a time shows as deleting. */
  setPendingDeleteId: (id: string | null) => void;
}

export function useSubSubcategoryForm({ refresh, setPendingDeleteId }: UseSubSubcategoryFormArgs) {
  const confirm = useConfirm();
  const [selectedCategoryForSubSub, setSelectedCategoryForSubSub] = useState<string>('');
  const [selectedSubcategoryForSubSub, setSelectedSubcategoryForSubSub] = useState<string>('');
  const [newSubSubName, setNewSubSubName] = useState('');
  const [newSubSubSlug, setNewSubSubSlug] = useState('');
  const [isAddingSubSub, setIsAddingSubSub] = useState(false);

  /** The slug is prefixed with the parent subcategory, which is why it is
   *  regenerated both when the name changes and when the parent does. */
  const handleSubSubNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewSubSubName(name);
    setNewSubSubSlug(
      selectedSubcategoryForSubSub ? `${selectedSubcategoryForSubSub}-${slugify(name)}` : slugify(name)
    );
  };

  /** Changing the category resets the subcategory choice — its list of
   *  subcategories has just changed out from under it. */
  const handleCategoryForSubSubChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategoryForSubSub(e.target.value);
    setSelectedSubcategoryForSubSub('');
    setNewSubSubSlug(slugify(newSubSubName));
  };

  const handleSubcategoryForSubSubChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubcategoryForSubSub(e.target.value);
    if (newSubSubName) {
      setNewSubSubSlug(`${e.target.value}-${slugify(newSubSubName)}`);
    }
  };

  const handleAddSubSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubSubName || !newSubSubSlug || !selectedSubcategoryForSubSub) return;

    setIsAddingSubSub(true);
    try {
      const res = await adminFetch('/api/admin/subsubcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSubSubName,
          slug: newSubSubSlug,
          subcategory_slug: selectedSubcategoryForSubSub,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setNewSubSubName('');
        setNewSubSubSlug('');
        setSelectedCategoryForSubSub('');
        setSelectedSubcategoryForSubSub('');
        refresh();
      } else {
        toast.error(data.error || 'Failed to create sub-subcategory');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsAddingSubSub(false);
    }
  };

  const handleDeleteSubSubcategory = async (id: string, name?: string) => {
    const confirmed = await confirm({
      title: name ? `Delete ${name}?` : 'Delete this sub-subcategory?',
      consequences: [
        'Removes it from the storefront nav and the products filter',
        'Products stay, but stop being reachable through this sub-subcategory',
        'Cannot be undone',
      ],
      confirmLabel: 'Delete sub-subcategory',
    });
    if (!confirmed) return;

    setPendingDeleteId(id);
    try {
      const res = await adminFetch('/api/admin/subsubcategories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();

      if (data.success) {
        refresh();
      } else {
        toast.error(data.error || 'Failed to delete sub-subcategory');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setPendingDeleteId(null);
    }
  };

  return {
    selectedCategoryForSubSub,
    selectedSubcategoryForSubSub,
    newSubSubName,
    newSubSubSlug,
    isAddingSubSub,
    handleSubSubNameChange,
    handleCategoryForSubSubChange,
    handleSubcategoryForSubSubChange,
    handleAddSubSubcategory,
    handleDeleteSubSubcategory,
  };
}
