/** ADMIN layer hook — categories/subcategories data + form state for the Manage Categories page. */
'use client';

import { useState, useEffect } from 'react';
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
        alert(data.error || 'Failed to create category');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setIsAddingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? All its subcategories will also be deleted.')) return;

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
        alert(data.error || 'Failed to delete category');
      }
    } catch (err) {
      alert('Network error');
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
        alert(data.error || 'Failed to create subcategory');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setIsAddingSub(false);
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subcategory?')) return;

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
        alert(data.error || 'Failed to delete subcategory');
      }
    } catch (err) {
      alert('Network error');
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
    handleCatNameChange,
    handleSubNameChange,
    handleParentCategoryChange,
    handleAddCategory,
    handleDeleteCategory,
    handleAddSubcategory,
    handleDeleteSubcategory,
  };
}
