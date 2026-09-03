/** ADMIN layer — pricing, stock, size and color configuration section of the product form. */
'use client';

import { Plus } from 'lucide-react';
import { FieldErrors, UseFormRegister, UseFormWatch } from 'react-hook-form';
import { Checkbox, Input } from '@/components/ui';
import { ProductFormValues } from '@/lib/commerce/product-form-schema';
import { VariantSize } from '@/lib/commerce/product-form-helpers';
import { VariantGroupCard } from './VariantGroupCard';
import CostInput from './CostInput';
import SingleCostField from './SingleCostField';
import type { SizingType } from '@/lib/commerce/product-form-schema';
import { SizingTypeToggle } from './SizingTypeToggle';

export interface PricingVariantsEditorProps {
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  /** Used only for the live margin beside the cost field. */
  watch: UseFormWatch<ProductFormValues>;
  hasVariants: boolean;
  toggleHasVariants: (checked: boolean) => void;
  hasSizes: boolean;
  setHasSizes: (value: boolean) => void;
  hasColors: boolean;
  setHasColors: (value: boolean) => void;
  sizingType: SizingType;
  setSizingType: (value: SizingType) => void;
  variants: VariantSize[];
  addVariant: () => void;
  removeVariant: (vIdx: number) => void;
  updateVariantSize: (vIdx: number, value: string) => void;
  updateVariantPrice: (vIdx: number, value: number) => void;
  updateVariantStock: (vIdx: number, value: number) => void;
  updateVariantCost: (vIdx: number, value: number | null) => void;
  blurVariantSize: (vIdx: number) => void;
  addColorToVariant: (vIdx: number) => void;
  removeColorFromVariant: (vIdx: number, cIdx: number) => void;
  updateColorName: (vIdx: number, cIdx: number, value: string) => void;
  updateColorPrice: (vIdx: number, cIdx: number, value: number) => void;
  updateColorStock: (vIdx: number, cIdx: number, value: number) => void;
  updateColorCost: (vIdx: number, cIdx: number, value: number | null) => void;
  blurColorName: (vIdx: number, cIdx: number) => void;
}

export function PricingVariantsEditor({
  register,
  errors,
  watch,
  hasVariants,
  toggleHasVariants,
  hasSizes,
  setHasSizes,
  hasColors,
  setHasColors,
  sizingType,
  setSizingType,
  variants,
  addVariant,
  removeVariant,
  updateVariantSize,
  updateVariantPrice,
  updateVariantStock,
  updateVariantCost,
  blurVariantSize,
  addColorToVariant,
  removeColorFromVariant,
  updateColorName,
  updateColorPrice,
  updateColorStock,
  updateColorCost,
  blurColorName,
}: PricingVariantsEditorProps) {
  return (
    <div className="bg-background-secondary p-5 md:p-8 rounded-surface border border-border-light mb-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-body-lg font-bold text-text-primary">Pricing & Variants</h3>
          <p className="text-body-sm text-text-secondary mt-1">Configure pricing, stock, sizes and colors.</p>
        </div>
        <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-control border border-border">
          <label className="text-body-sm font-medium text-text-primary cursor-pointer flex items-center gap-2">
            <Checkbox checked={hasVariants} onChange={(e) => toggleHasVariants(e.target.checked)} />
            Product has multiple options
          </label>
        </div>
      </div>

      {!hasVariants ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-surface rounded-surface border border-border">
          <div>
            <label className="block text-body-sm font-bold text-text-primary mb-2">
              Base Price (₦) <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary font-medium">₦</span>
              <Input
                {...register('price')}
                type="number"
                onFocus={(e) => e.target.select()}
                invalid={!!errors.price}
                className="pl-8"
                min="0"
                step="100"
                placeholder="0"
              />
            </div>
            {errors.price && <p className="text-destructive text-body-sm mt-1.5">{errors.price.message}</p>}
          </div>
          <div>
            <label className="block text-body-sm font-bold text-text-primary mb-2">
              Total Stock <span className="text-destructive">*</span>
            </label>
            <Input {...register('stock')} type="number" onFocus={(e) => e.target.select()} invalid={!!errors.stock} min="0" placeholder="0" />
            {errors.stock && <p className="text-destructive text-body-sm mt-1.5">{errors.stock.message}</p>}
          </div>
          {/* Cost for a product with no variants. Live margin beside it, so
              the admin sees whether the price they set actually earns. */}
          <SingleCostField register={register} errors={errors} watch={watch} />
          <div>
            <label className="block text-body-sm font-bold text-text-primary mb-2">Size/Age (Optional)</label>
            <Input {...register('singleSize')} type="text" placeholder="e.g., XL, 2-3 Years" />
          </div>
          <div>
            <label className="block text-body-sm font-bold text-text-primary mb-2">Color (Optional)</label>
            <Input {...register('singleColor')} type="text" placeholder="e.g., Red, Blue" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4 p-4 bg-surface rounded-surface border border-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={hasSizes} onChange={(e) => setHasSizes(e.target.checked)} />
              <span className="text-body-sm font-medium text-text-primary">Has Sizes/Ages</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={hasColors} onChange={(e) => setHasColors(e.target.checked)} />
              <span className="text-body-sm font-medium text-text-primary">Has Colors</span>
            </label>
            {hasSizes && <SizingTypeToggle value={sizingType} onChange={setSizingType} />}
          </div>

          <div className="space-y-4">
            {variants.map((variant, vIdx) => (
              <VariantGroupCard
                key={vIdx}
                variant={variant}
                vIdx={vIdx}
                canRemove={variants.length > 1}
                hasSizes={hasSizes}
                hasColors={hasColors}
                sizingType={sizingType}
                onRemoveVariant={removeVariant}
                onUpdateSize={updateVariantSize}
                onUpdatePrice={updateVariantPrice}
                onUpdateStock={updateVariantStock}
                onUpdateCost={updateVariantCost}
                onBlurSize={blurVariantSize}
                onAddColor={addColorToVariant}
                onUpdateColorName={updateColorName}
                onUpdateColorPrice={updateColorPrice}
                onUpdateColorStock={updateColorStock}
                onUpdateColorCost={updateColorCost}
                onBlurColorName={blurColorName}
                onRemoveColor={removeColorFromVariant}
              />
            ))}

            {hasSizes && (
              <button
                type="button"
                onClick={addVariant}
                className="w-full py-3 border-2 border-dashed border-border-strong text-text-secondary hover:text-primary hover:border-primary/40 hover:bg-primary/5 rounded-surface font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Add Another {sizingType === 'age' ? 'Age Group' : 'Size'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
