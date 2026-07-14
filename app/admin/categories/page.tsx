/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Tag, Layers } from 'lucide-react';
import { Button, Input, Spinner } from '@/components/ui';

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  category_slug: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  subcategories: Subcategory[];
}

export default function CategoriesPage() {
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

  const router = useRouter();

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
    setNewCatSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
  };

  const handleSubNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewSubName(name);
    if (selectedCategoryForSub) {
      setNewSubSlug(`${selectedCategoryForSub}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}`);
    } else {
      setNewSubSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
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

  if (loading && categories.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-h4 font-bold text-text-primary">Manage Categories</h1>
          <p className="text-text-secondary">Add, edit, or remove product categories and subcategories.</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive-background text-destructive p-4 rounded-control mb-6 border border-destructive-border">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Forms Section */}
        <div className="lg:col-span-1 space-y-6">

          {/* Add Category Form */}
          <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border-light">
            <div className="flex items-center gap-2 mb-4 text-primary font-semibold">
              <Layers size={20} />
              <h3>Add New Category</h3>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-body-sm font-medium text-text-primary mb-1">Category Name</label>
                <Input
                  type="text"
                  value={newCatName}
                  onChange={handleCatNameChange}
                  placeholder="e.g. Toys"
                  required
                />
              </div>
              <div>
                <label className="block text-body-sm font-medium text-text-primary mb-1">URL Slug</label>
                <Input
                  type="text"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                  className="bg-background-secondary text-text-secondary font-mono text-body-sm"
                  readOnly
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={isAddingCat || !newCatName}
                loading={isAddingCat}
                className="w-full"
              >
                <Plus size={18} />
                Create Category
              </Button>
            </form>
          </div>

          {/* Add Subcategory Form */}
          <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border-light">
            <div className="flex items-center gap-2 mb-4 text-accent font-semibold">
              <Tag size={20} />
              <h3>Add New Subcategory</h3>
            </div>

            <form onSubmit={handleAddSubcategory} className="space-y-4">
              <div>
                <label className="block text-body-sm font-medium text-text-primary mb-1">Parent Category</label>
                <select
                  value={selectedCategoryForSub}
                  onChange={(e) => {
                    setSelectedCategoryForSub(e.target.value);
                    if (newSubName) {
                      setNewSubSlug(`${e.target.value}-${newSubName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}`);
                    }
                  }}
                  className="w-full rounded-control border border-border bg-surface px-3 py-2 text-text-primary"
                  required
                >
                  <option value="">Select a category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-body-sm font-medium text-text-primary mb-1">Subcategory Name</label>
                <Input
                  type="text"
                  value={newSubName}
                  onChange={handleSubNameChange}
                  placeholder="e.g. Educational Toys"
                  required
                />
              </div>
              <div>
                <label className="block text-body-sm font-medium text-text-primary mb-1">URL Slug</label>
                <Input
                  type="text"
                  value={newSubSlug}
                  className="bg-background-secondary text-text-secondary font-mono text-body-sm"
                  readOnly
                  required
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                disabled={isAddingSub || !newSubName || !selectedCategoryForSub}
                loading={isAddingSub}
                className="w-full"
              >
                <Plus size={18} />
                Create Subcategory
              </Button>
            </form>
          </div>
        </div>

        {/* Categories List Section */}
        <div className="lg:col-span-2">
          <div className="bg-surface rounded-surface shadow-elevation-1 border border-border-light overflow-hidden">
            <div className="p-6 border-b border-border-light bg-background-secondary flex justify-between items-center">
              <h3 className="font-semibold text-text-primary">Current Categories</h3>
              <span className="text-body-sm text-text-secondary">{categories.length} Categories</span>
            </div>

            {categories.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                No categories found. Create one to get started.
              </div>
            ) : (
              <div className="divide-y divide-divider">
                {categories.map(category => (
                  <div key={category.id} className="p-6 hover:bg-surface-hover transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-control bg-gradient-to-br ${category.color} shadow-elevation-1 flex items-center justify-center text-text-inverse font-bold text-body-lg`}>
                          {category.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-text-primary text-body-lg">{category.name}</h4>
                          <p className="text-caption-md text-text-secondary font-mono">/{category.slug}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-text-muted hover:text-destructive p-2 rounded-control hover:bg-destructive-background transition-colors"
                        title="Delete Category"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="pl-13 ml-4 border-l-2 border-border-light pb-2">
                      <h5 className="text-caption-md font-semibold text-text-secondary uppercase tracking-wider mb-3 ml-4">Subcategories</h5>
                      {category.subcategories && category.subcategories.length > 0 ? (
                        <ul className="space-y-2 ml-4">
                          {category.subcategories.map(sub => (
                            <li key={sub.id} className="flex justify-between items-center bg-surface border border-border-light p-3 rounded-control shadow-elevation-1">
                              <div>
                                <span className="font-medium text-text-primary">{sub.name}</span>
                                <span className="text-caption-md text-text-muted font-mono ml-2">/{sub.slug}</span>
                              </div>
                              <button
                                onClick={() => handleDeleteSubcategory(sub.id)}
                                className="text-text-muted hover:text-destructive p-1"
                              >
                                <Trash2 size={16} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-body-sm text-text-muted italic ml-4">No subcategories yet.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
