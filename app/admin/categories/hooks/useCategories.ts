/** ADMIN layer hook — categories/subcategories data + form state for the Manage Categories page. */
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { slugify } from '@/lib/commerce/format-text';
import type { Category } from '@/types/product';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';
import { useSubcategoryForm } from './useSubcategoryForm';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Which category/subcategory row is currently being deleted
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Which category's size guidance is being written. Per-row, so one save does
  // not put every category's button in a pending state.
  const [savingGuidanceId, setSavingGuidanceId] = useState<string | null>(null);

  // The subcategory form is its own hook, composed here so the page keeps one
  // destructure. It needs only a way to refresh the list and the shared
  // per-row deleting flag.
  const subcategories = useSubcategoryForm({
    refresh: () => fetchCategories(),
    setPendingDeleteId,
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
    if (!confirm('Are you sure you want to delete this category? All its subcategories will also be deleted.')) return;

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

  /**
   * Saves one category's size guidance. An empty string clears it — the route
   * stores that as NULL, so the storefront shows the tables alone.
   */
  const handleSaveGuidance = async (id: string, guidance: string) => {
    setSavingGuidanceId(id);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, size_guidance: guidance })
      });
      const data = await res.json();

      if (data.success) {
        toast.success(guidance.trim() ? 'Size guidance saved' : 'Size guidance removed');
        fetchCategories({ silent: true });
      } else {
        toast.error(data.error || 'Failed to save size guidance');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setSavingGuidanceId(null);
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
    savingGuidanceId,
    handleCatNameChange,
    handleAddCategory,
    handleDeleteCategory,
    handleSaveGuidance,
    ...subcategories,
  };
}
