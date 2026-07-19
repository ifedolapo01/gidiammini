/** ADMIN layer component — "Add New Subcategory" form card for the Manage Categories page. */
'use client';

import { Plus, Tag } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import type { Category } from '@/types/product';

interface AddSubcategoryFormProps {
  categories: Category[];
  selectedCategoryForSub: string;
  newSubName: string;
  newSubSlug: string;
  isAddingSub: boolean;
  onParentChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function AddSubcategoryForm({
  categories,
  selectedCategoryForSub,
  newSubName,
  newSubSlug,
  isAddingSub,
  onParentChange,
  onNameChange,
  onSubmit,
}: AddSubcategoryFormProps) {
  return (
    <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border-light">
      <div className="flex items-center gap-2 mb-4 text-accent font-semibold">
        <Tag size={20} />
        <h3>Add New Subcategory</h3>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1">Parent Category</label>
          <Select value={selectedCategoryForSub} onChange={onParentChange} required>
            <option value="">Select a category...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.slug}>{cat.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1">Subcategory Name</label>
          <Input
            type="text"
            value={newSubName}
            onChange={onNameChange}
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
  );
}
