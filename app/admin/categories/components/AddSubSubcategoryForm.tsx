/** ADMIN layer component — "Add New Sub-subcategory" form card for the Manage Categories page. */
'use client';

import { Plus, Layers3 } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import type { Category } from '@/types/product';

interface AddSubSubcategoryFormProps {
  categories: Category[];
  selectedCategoryForSubSub: string;
  selectedSubcategoryForSubSub: string;
  newSubSubName: string;
  newSubSubSlug: string;
  isAddingSubSub: boolean;
  onCategoryChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSubcategoryChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function AddSubSubcategoryForm({
  categories,
  selectedCategoryForSubSub,
  selectedSubcategoryForSubSub,
  newSubSubName,
  newSubSubSlug,
  isAddingSubSub,
  onCategoryChange,
  onSubcategoryChange,
  onNameChange,
  onSubmit,
}: AddSubSubcategoryFormProps) {
  // Only the selected category's own subcategories are offerable as a parent
  // — the same cascade the product form's category fields use.
  const subcategoryOptions =
    categories.find((cat) => cat.slug === selectedCategoryForSubSub)?.subcategories ?? [];

  return (
    <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border-light">
      <div className="flex items-center gap-2 mb-4 text-primary font-semibold">
        <Layers3 size={20} />
        <h3>Add New Sub-subcategory</h3>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1">Category</label>
          <Select value={selectedCategoryForSubSub} onChange={onCategoryChange} required>
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>{cat.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1">Parent Subcategory</label>
          <Select
            value={selectedSubcategoryForSubSub}
            onChange={onSubcategoryChange}
            disabled={!selectedCategoryForSubSub}
            required
          >
            <option value="">Select a subcategory...</option>
            {subcategoryOptions.map((sub) => (
              <option key={sub.id} value={sub.slug}>{sub.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1">Sub-subcategory Name</label>
          <Input
            type="text"
            value={newSubSubName}
            onChange={onNameChange}
            placeholder="e.g. Monitors"
            required
          />
        </div>
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1">URL Slug</label>
          <Input
            type="text"
            value={newSubSubSlug}
            className="bg-background-secondary text-text-secondary font-mono text-body-sm"
            readOnly
            required
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={isAddingSubSub || !newSubSubName || !selectedSubcategoryForSubSub}
          loading={isAddingSubSub}
          className="w-full"
        >
          <Plus size={18} />
          Create Sub-subcategory
        </Button>
      </form>
    </div>
  );
}
