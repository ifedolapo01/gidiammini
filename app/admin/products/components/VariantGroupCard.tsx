/** ADMIN layer — one size/age group card within the pricing & variants editor. */
'use client';

import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui';
import { VariantSize } from '@/lib/commerce/product-form-helpers';
import { VariantColorRow } from './VariantColorRow';

export interface VariantGroupCardProps {
  variant: VariantSize;
  vIdx: number;
  canRemove: boolean;
  hasSizes: boolean;
  hasColors: boolean;
  sizingType: 'size' | 'age';
  onRemoveVariant: (vIdx: number) => void;
  onUpdateSize: (vIdx: number, value: string) => void;
  onUpdatePrice: (vIdx: number, value: number) => void;
  onUpdateStock: (vIdx: number, value: number) => void;
  onBlurSize: (vIdx: number) => void;
  onAddColor: (vIdx: number) => void;
  onUpdateColorName: (vIdx: number, cIdx: number, value: string) => void;
  onUpdateColorPrice: (vIdx: number, cIdx: number, value: number) => void;
  onUpdateColorStock: (vIdx: number, cIdx: number, value: number) => void;
  onBlurColorName: (vIdx: number, cIdx: number) => void;
  onRemoveColor: (vIdx: number, cIdx: number) => void;
}

export function VariantGroupCard({
  variant,
  vIdx,
  canRemove,
  hasSizes,
  hasColors,
  sizingType,
  onRemoveVariant,
  onUpdateSize,
  onUpdatePrice,
  onUpdateStock,
  onBlurSize,
  onAddColor,
  onUpdateColorName,
  onUpdateColorPrice,
  onUpdateColorStock,
  onBlurColorName,
  onRemoveColor,
}: VariantGroupCardProps) {
  return (
    <div className="border border-primary/20 bg-primary/5 rounded-surface p-5 relative">
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemoveVariant(vIdx)}
          className="absolute right-4 top-4 text-destructive/70 hover:text-destructive p-1"
          title="Remove this group"
        >
          <X size={18} />
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {hasSizes && (
          <div className="md:col-span-1">
            <label className="block text-caption-md font-bold text-text-secondary uppercase tracking-wider mb-1">
              {sizingType === 'age' ? 'Age Group' : 'Size'}
            </label>
            <Input
              size="sm"
              type="text"
              value={variant.size}
              onChange={(e) => onUpdateSize(vIdx, e.target.value)}
              onBlur={() => onBlurSize(vIdx)}
              placeholder={sizingType === 'age' ? 'e.g., 3-6 Months' : 'e.g., Medium'}
            />
          </div>
        )}

        {!hasColors && (
          <>
            <div className="md:col-span-1">
              <label className="block text-caption-md font-bold text-text-secondary uppercase tracking-wider mb-1">Price (₦)</label>
              <Input
                size="sm"
                type="number"
                onFocus={(e) => e.target.select()}
                value={variant.price || ''}
                onChange={(e) => onUpdatePrice(vIdx, Number(e.target.value))}
                placeholder="Price"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-caption-md font-bold text-text-secondary uppercase tracking-wider mb-1">Stock Qty</label>
              <Input
                size="sm"
                type="number"
                onFocus={(e) => e.target.select()}
                value={variant.stock || ''}
                onChange={(e) => onUpdateStock(vIdx, Number(e.target.value))}
                placeholder="Qty"
              />
            </div>
          </>
        )}
      </div>

      {hasColors && (
        <div className="bg-surface rounded-surface border border-border p-4 shadow-elevation-1">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-body-sm font-semibold text-text-primary">
              Colors for {hasSizes ? variant.size || 'this size' : 'this product'}
            </h4>
            <button
              type="button"
              onClick={() => onAddColor(vIdx)}
              className="text-caption-md font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-control hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <Plus size={14} /> Add Color
            </button>
          </div>
          <div className="space-y-2">
            {variant.colors.map((color, cIdx) => (
              <VariantColorRow
                key={cIdx}
                color={color}
                vIdx={vIdx}
                cIdx={cIdx}
                onUpdateName={onUpdateColorName}
                onUpdatePrice={onUpdateColorPrice}
                onUpdateStock={onUpdateColorStock}
                onBlurName={onBlurColorName}
                onRemove={onRemoveColor}
              />
            ))}
            {variant.colors.length === 0 && (
              <p className="text-caption-md text-warning italic py-2">No colors added. Click 'Add Color' above.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
