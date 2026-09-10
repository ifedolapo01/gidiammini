/** ADMIN layer — one color/price/stock row within a variant group card. */
'use client';

import { X } from 'lucide-react';
import { VariantColor } from '@/lib/commerce/product-form-helpers';
import CostInput from './CostInput';

export interface VariantColorRowProps {
  color: VariantColor;
  vIdx: number;
  cIdx: number;
  onUpdateName: (vIdx: number, cIdx: number, value: string) => void;
  onUpdatePrice: (vIdx: number, cIdx: number, value: number) => void;
  onUpdateStock: (vIdx: number, cIdx: number, value: number) => void;
  onUpdateCost: (vIdx: number, cIdx: number, value: number | null) => void;
  onBlurName: (vIdx: number, cIdx: number) => void;
  onRemove: (vIdx: number, cIdx: number) => void;
}

export function VariantColorRow({
  color,
  vIdx,
  cIdx,
  onUpdateName,
  onUpdatePrice,
  onUpdateStock,
  onUpdateCost,
  onBlurName,
  onRemove,
}: VariantColorRowProps) {
  return (
    <div className="flex flex-wrap sm:flex-nowrap gap-2 items-start bg-background-secondary/50 p-2 rounded-control border border-border-light">
      <input
        type="text"
        aria-label="Color name"
        value={color.name}
        onChange={(e) => onUpdateName(vIdx, cIdx, e.target.value)}
        onBlur={() => onBlurName(vIdx, cIdx)}
        className="flex-1 min-w-[120px] border border-border-strong rounded-control px-3 py-1.5 text-body-sm text-text-primary bg-surface"
        placeholder="Color Name"
      />
      <div className="relative w-28 sm:w-32">
        <span aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary text-caption-md">₦</span>
        <input
          type="number"
          aria-label="Selling price"
          onFocus={(e) => e.target.select()}
          value={color.price || ''}
          onChange={(e) => onUpdatePrice(vIdx, cIdx, Number(e.target.value))}
          className="w-full border border-border-strong rounded-control pl-6 pr-2 py-1.5 text-body-sm text-text-primary bg-surface"
          placeholder="Price"
        />
      </div>
      <input
        type="number"
        aria-label="Stock quantity"
        onFocus={(e) => e.target.select()}
        value={color.stock || ''}
        onChange={(e) => onUpdateStock(vIdx, cIdx, Number(e.target.value))}
        className="w-20 sm:w-24 border border-border-strong rounded-control px-2 py-1.5 text-body-sm text-text-primary bg-surface"
        placeholder="Stock"
      />
      <CostInput
        price={color.price}
        cost={color.cost}
        onChange={(cost) => onUpdateCost(vIdx, cIdx, cost)}
        aria-label="Cost price"
      />
      <button
        type="button"
        onClick={() => onRemove(vIdx, cIdx)}
        className="p-1.5 text-text-muted hover:text-destructive rounded-control transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
