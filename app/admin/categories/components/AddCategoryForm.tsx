/** ADMIN layer component — "Add New Category" form card for the Manage Categories page. */
'use client';

import { Plus, Layers } from 'lucide-react';
import { Button, Input } from '@/components/ui';

interface AddCategoryFormProps {
  newCatName: string;
  newCatSlug: string;
  isAddingCat: boolean;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSlugChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function AddCategoryForm({
  newCatName,
  newCatSlug,
  isAddingCat,
  onNameChange,
  onSlugChange,
  onSubmit,
}: AddCategoryFormProps) {
  return (
    <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border-light">
      <div className="flex items-center gap-2 mb-4 text-primary font-semibold">
        <Layers size={20} />
        <h3>Add New Category</h3>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1">Category Name</label>
          <Input
            type="text"
            value={newCatName}
            onChange={onNameChange}
            placeholder="e.g. Toys"
            required
          />
        </div>
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1">URL Slug</label>
          <Input
            type="text"
            value={newCatSlug}
            onChange={onSlugChange}
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
  );
}
