/** ADMIN layer — one color/price/stock row within a variant group card. */
'use client';

import { X } from 'lucide-react';
import { VariantColor } from '@/lib/commerce/product-form-helpers';

export interface VariantColorRowProps {
  color: VariantColor;
  vIdx: number;
  cIdx: number;
  onUpdateName: (vIdx: number, cIdx: number, value: string) => void;
  onUpdatePrice: (vIdx: number, cIdx: number, value: number) => void;
  onUpdateStock: (vIdx: number, cIdx: number, value: number) => void;
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
  onBlurName,
  onRemove,
}: VariantColorRowProps) {
  return (
    <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center bg-background-secondary/50 p-2 rounded-control border border-border-light">
      <input
        type="text"
        value={color.name}
        onChange={(e) => onUpdateName(vIdx, cIdx, e.target.value)}
        onBlur={() => onBlurName(vIdx, cIdx)}
        className="flex-1 min-w-[120px] border border-border-strong rounded-control px-3 py-1.5 text-body-sm text-text-primary bg-surface"
        placeholder="Color Name"
      />
      <div className="relative w-28 sm:w-32">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary text-caption-md">₦</span>
        <input
          type="number"
          onFocus={(e) => e.target.select()}
          value={color.price || ''}
          onChange={(e) => onUpdatePrice(vIdx, cIdx, Number(e.target.value))}
          className="w-full border border-border-strong rounded-control pl-6 pr-2 py-1.5 text-body-sm text-text-primary bg-surface"
          placeholder="Price"
        />
      </div>
      <input
        type="number"
        onFocus={(e) => e.target.select()}
        value={color.stock || ''}
        onChange={(e) => onUpdateStock(vIdx, cIdx, Number(e.target.value))}
        className="w-20 sm:w-24 border border-border-strong rounded-control px-2 py-1.5 text-body-sm text-text-primary bg-surface"
        placeholder="Stock"
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
