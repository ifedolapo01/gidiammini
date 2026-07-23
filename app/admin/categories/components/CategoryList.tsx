/** ADMIN layer component — "Current Categories" list section for the Manage Categories page. */
'use client';

import { Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui';
import type { Category } from '@/types/product';

interface CategoryListProps {
  categories: Category[];
  pendingDeleteId: string | null;
  onDeleteCategory: (id: string) => void;
  onDeleteSubcategory: (id: string) => void;
}

export function CategoryList({ categories, pendingDeleteId, onDeleteCategory, onDeleteSubcategory }: CategoryListProps) {
  return (
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
                  onClick={() => onDeleteCategory(category.id)}
                  disabled={pendingDeleteId === category.id}
                  className="text-text-muted hover:text-destructive p-2 rounded-control hover:bg-destructive-background transition-colors disabled:opacity-60 disabled:pointer-events-none"
                  title="Delete Category"
                >
                  {pendingDeleteId === category.id ? <Spinner size="xs" /> : <Trash2 size={18} />}
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
                          onClick={() => onDeleteSubcategory(sub.id)}
                          disabled={pendingDeleteId === sub.id}
                          className="text-text-muted hover:text-destructive p-1 disabled:opacity-60 disabled:pointer-events-none"
                        >
                          {pendingDeleteId === sub.id ? <Spinner size="xs" /> : <Trash2 size={16} />}
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
  );
}
