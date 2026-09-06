/** ADMIN layer hook — categories/subcategories data + form state for the Manage Categories page. */
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui';
import { slugify } from '@/lib/commerce/format-text';
import type { Category } from '@/types/product';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';
import { useSubcategoryForm } from './useSubcategoryForm';
import { useCategoryPatch } from './useCategoryPatch';

export function useCategories() {
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Which category/subcategory row is currently being deleted
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // The subcategory form is its own hook, composed here so the page keeps one
  // destructure. It needs only a way to refresh the list and the shared
  // per-row deleting flag.
  const subcategories = useSubcategoryForm({
    refresh: () => fetchCategories(),
    setPendingDeleteId,
  });

  // The two editable fields on a category, each saved through the same PATCH.
  // Separate instances so their pending states are independent — see
  // useCategoryPatch.
  const guidance = useCategoryPatch({
    field: 'size_guidance',
    labels: { saved: 'Size guidance saved', cleared: 'Size guidance removed' },
    onSaved: () => fetchCategories({ silent: true }),
  });

  const displayName = useCategoryPatch({
    field: 'display_name',
    labels: { saved: 'Storefront name saved', cleared: 'Storefront name reset' },
    onSaved: () => fetchCategories({ silent: true }),
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async (opts: { silent?: boolean } = {}) => {
    try {
      if (!opts.silent) setLoading(true);
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      } else if (!opts.silent) {
        setError(data.error || 'Failed to load categories');
      }
    } catch (err) {
      if (opts.silent) console.error('Error syncing categories:', err);
      else setError('Network error loading categories');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  };

  // Background poll — keeps the list fresh without a manual Refresh button.
  useEffect(() => {
    const interval = setInterval(() => fetchCategories({ silent: true }), ADMIN_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate slug from name
  const handleCatNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewCatName(name);
    setNewCatSlug(slugify(name));
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName || !newCatSlug) return;

    setIsAddingCat(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName, slug: newCatSlug })
      });
      const data = await res.json();

      if (data.success) {
        setNewCatName('');
        setNewCatSlug('');
        fetchCategories();
      } else {
        toast.error(data.error || 'Failed to create category');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsAddingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    // The list is already in hand, so the dialog can say what deleting this
    // one actually costs instead of the generic warning window.confirm had
    // room for. A category with nine subcategories under it and one with none
    // are not the same decision.
    const category = categories.find((candidate) => candidate.id === id);
    const subcategoryCount = category?.subcategories?.length ?? 0;

    const confirmed = await confirm({
      title: category ? `Delete ${category.name}?` : 'Delete this category?',
      message: 'Products in it keep their own category field, but nothing will link to them from the storefront nav.',
      consequences: [
        subcategoryCount > 0
          ? `Deletes ${subcategoryCount} subcategor${subcategoryCount === 1 ? 'y' : 'ies'} with it`
          : 'This category has no subcategories',
        'Removes it from the storefront navigation and filters',
        'Cannot be undone',
      ],
      confirmLabel: 'Delete category',
      // A category is the top of the tree and there is no restore: worth the
      // extra beat. Subcategories and discounts are not typed.
      typeToConfirm: category?.name,
    });
    if (!confirmed) return;

    setPendingDeleteId(id);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();

      if (data.success) {
        fetchCategories();
      } else {
        toast.error(data.error || 'Failed to delete category');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setPendingDeleteId(null);
    }
  };

  return {
    categories,
    loading,
    error,
    newCatName,
    newCatSlug,
    setNewCatSlug,
    isAddingCat,
    pendingDeleteId,
    savingGuidanceId: guidance.savingId,
    savingDisplayNameId: displayName.savingId,
    handleCatNameChange,
    handleAddCategory,
    handleDeleteCategory,
    handleSaveGuidance: guidance.save,
    handleSaveDisplayName: displayName.save,
    ...subcategories,
  };
}
