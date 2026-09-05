/** ADMIN layer — the bulk controls for the products table.
 *
 * Four actions, each one request: end-of-season markdown, a category move, and
 * activate / deactivate. All of them go through the shared undo window, so
 * nothing is written until the countdown finishes.
 */
'use client';

import { useState } from 'react';
import { Percent, FolderInput, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import type { Category } from '@/types/product';
import { isValidPercent } from '@/lib/commerce/price-adjust';
import BulkActionBar from '../../components/BulkActionBar';
import type { PendingBulkAction } from '../../hooks/useBulkAction';

interface ProductsBulkBarProps {
  selectedIds: string[];
  categories: Category[];
  pending: PendingBulkAction | null;
  running: boolean;
  onSetActive: (ids: string[], isActive: boolean) => void;
  onMoveCategory: (ids: string[], category: string, subCategory: string | null) => void;
  onAdjustPrice: (ids: string[], percent: number) => void;
  onUndo: () => void;
  onApplyNow: () => void;
  onClear: () => void;
}

export function ProductsBulkBar({
  selectedIds,
  categories,
  pending,
  running,
  onSetActive,
  onMoveCategory,
  onAdjustPrice,
  onUndo,
  onApplyNow,
  onClear,
}: ProductsBulkBarProps) {
  const [categorySlug, setCategorySlug] = useState('');
  const [subCategorySlug, setSubCategorySlug] = useState('');
  const [percentText, setPercentText] = useState('');

  const percent = Number(percentText);
  const percentValid = percentText.trim() !== '' && isValidPercent(percent);
  const subcategories = categories.find((category) => category.slug === categorySlug)?.subcategories ?? [];

  return (
    <BulkActionBar
      count={selectedIds.length}
      pending={pending}
      running={running}
      onUndo={onUndo}
      onApplyNow={onApplyNow}
      onClear={onClear}
    >
      <div className="flex items-center gap-1">
        <Percent className="w-4 h-4 text-text-secondary" aria-hidden="true" />
        <Input
          type="number"
          size="sm"
          className="w-24"
          placeholder="-30"
          value={percentText}
          onChange={(event) => setPercentText(event.target.value)}
          aria-label="Percentage price change, negative for a markdown"
        />
        <Button
          size="sm"
          disabled={!percentValid}
          onClick={() => onAdjustPrice(selectedIds, percent)}
        >
          Adjust price
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <FolderInput className="w-4 h-4 text-text-secondary" aria-hidden="true" />
        <Select
          size="sm"
          className="w-40"
          value={categorySlug}
          onChange={(event) => {
            setCategorySlug(event.target.value);
            setSubCategorySlug('');
          }}
          aria-label="Category to move the selected products into"
        >
          <option value="">Move to category…</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>{category.name}</option>
          ))}
        </Select>

        {subcategories.length > 0 && (
          <Select
            size="sm"
            className="w-36"
            value={subCategorySlug}
            onChange={(event) => setSubCategorySlug(event.target.value)}
            aria-label="Subcategory to move the selected products into"
          >
            <option value="">No subcategory</option>
            {subcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.slug}>{subcategory.name}</option>
            ))}
          </Select>
        )}

        <Button
          size="sm"
          variant="outline"
          disabled={!categorySlug}
          onClick={() => onMoveCategory(selectedIds, categorySlug, subCategorySlug || null)}
        >
          Move
        </Button>
      </div>

      <Button size="sm" variant="outline" onClick={() => onSetActive(selectedIds, true)}>
        <Eye className="w-4 h-4" />
        Activate
      </Button>

      <Button size="sm" variant="outline" onClick={() => onSetActive(selectedIds, false)}>
        <EyeOff className="w-4 h-4" />
        Deactivate
      </Button>
    </BulkActionBar>
  );
}
