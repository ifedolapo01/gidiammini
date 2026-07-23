/** ADMIN layer hook — categories/subcategories data + form state for the Manage Categories page. */
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { slugify } from '@/lib/commerce/format-text';
import type { Category } from '@/types/product';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // New Subcategory State
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState<string>('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubSlug, setNewSubSlug] = useState('');
  const [isAddingSub, setIsAddingSub] = useState(false);

  // Which category/subcategory row is currently being deleted
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      } else {
        setError(data.error || 'Failed to load categories');
      }
    } catch (err) {
      setError('Network error loading categories');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate slug from name
  const handleCatNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewCatName(name);
    setNewCatSlug(slugify(name));
  };

  const handleSubNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewSubName(name);
    if (selectedCategoryForSub) {
      setNewSubSlug(`${selectedCategoryForSub}-${slugify(name)}`);
    } else {
      setNewSubSlug(slugify(name));
    }
  };

  const handleParentCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategoryForSub(e.target.value);
    if (newSubName) {
      setNewSubSlug(`${e.target.value}-${slugify(newSubName)}`);
    }
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
        fetchCategories();
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
        fetchCategories();
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
    categories,
    loading,
    error,
    newCatName,
    newCatSlug,
    setNewCatSlug,
    isAddingCat,
    selectedCategoryForSub,
    newSubName,
    newSubSlug,
    isAddingSub,
    pendingDeleteId,
    handleCatNameChange,
    handleSubNameChange,
    handleParentCategoryChange,
    handleAddCategory,
    handleDeleteCategory,
    handleAddSubcategory,
    handleDeleteSubcategory,
  };
}
